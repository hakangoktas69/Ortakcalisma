"""Yerel OCR ve isteğe bağlı tek seferlik giriş; kullanıcı girdisi korunur."""
import asyncio
import base64
import hashlib
import re
import shutil
import time
from pathlib import Path
from urllib.parse import urlsplit

import pytesseract
from gib_automation import read_captcha_suggestion
from local_ocr import read_local_suggestion

CAPTCHA_LABEL = re.compile(r'captcha|güvenlik\s*kodu|guvenlik\s*kodu|doğrulama\s*kodu|dogrulama\s*kodu', re.I)
MARKER = re.compile(r'captcha|security.?code|guvenlik|güvenlik', re.I)


async def image_content(image):
    # screenshot() görünür öğeyi kaydırabilir ve animasyon/stilleri etkileyebilir.
    # Mevcut görselin piksellerini DOM'a öğe eklemeden bellekte kopyala.
    data = await image.evaluate("""el => {
        if (el.tagName === 'CANVAS') return el.toDataURL('image/png');
        if (!el.complete || !el.naturalWidth) return null;
        if (el.naturalWidth > 2048 || el.naturalHeight > 2048) return null;
        const c = document.createElement('canvas');
        c.width = el.naturalWidth; c.height = el.naturalHeight;
        try { c.getContext('2d').drawImage(el, 0, 0); return c.toDataURL('image/png'); }
        catch (_) { return null; }
    }""")
    if not data:
        raise ValueError('CAPTCHA görsel pikselleri okunamıyor; elle giriş gerekli.')
    return base64.b64decode(data.split(',', 1)[1])


class CaptchaAssist:
    def __init__(self, *, auto_login=False):
        self.seen = set()
        self.attempts = 0
        self.unavailable = False
        self.notices = set()
        self.next_check = 0.0
        self.auto_login = auto_login
        self.submitted_at = None

    def notice(self, key, message):
        if key in self.notices:
            return ''
        self.notices.add(key)
        return message

    async def suggest(self, page):
        url = urlsplit(page.url)
        if (url.scheme, url.hostname, url.path.rstrip('/')) != ('https', 'dijital.gib.gov.tr', '/portal/login'):
            return ''
        if self.submitted_at is not None:
            if time.monotonic() - self.submitted_at > 15:
                return self.notice('login_pending', 'Otomatik giriş bir kez denendi. Giriş ekranı hâlâ açık; hata veya ek doğrulamayı kontrol edin. Yeniden otomatik deneme yapılmayacak.')
            return ''
        if time.monotonic() < self.next_check:
            return ''
        self.next_check = time.monotonic() + 8.0
        if self.unavailable or self.attempts >= 8:
            return ''
        exe = shutil.which('tesseract') or r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        neural_available = (Path(__file__).resolve().parent / '.ocr-venv' / 'Scripts' / 'python.exe').is_file()
        if not Path(exe).is_file() and not neural_available:
            self.unavailable = True
            return 'OCR motoru bulunamadı. Güvenlik kodunu elle girin.'
        fields = []
        for field in await page.locator('input').all():
            if not await field.is_visible() or not await field.is_editable():
                continue
            if (await field.get_attribute('type') or 'text').lower() not in ('text', 'tel'):
                continue
            label = await field.evaluate("el => [...(el.labels||[])].map(x=>x.innerText).join(' ')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('placeholder')||'')")
            if CAPTCHA_LABEL.search(label):
                fields.append(field)
        if len(fields) != 1:
            return self.notice('field', 'OCR için tek bir doğrulama kodu alanı tanınamadı. Kodu elle girin.')
        if (await fields[0].input_value()).strip():
            return ''
        images = []
        for image in await page.locator('img,canvas').all():
            if not await image.is_visible():
                continue
            description = ' '.join([(await image.get_attribute(a)) or '' for a in ('alt', 'aria-label', 'id', 'class', 'src')])
            if MARKER.search(description):
                images.append(image)
        if len(images) != 1:
            return self.notice('image', 'OCR için tek bir CAPTCHA görseli tanınamadı. Kodu elle girin.')
        try:
            image_bytes = await image_content(images[0])
        except ValueError:
            return self.notice('pixels', 'CAPTCHA görseli okunamıyor. Güvenlik kodunu elle girin.')
        digest = hashlib.sha256(image_bytes).digest()
        if digest in self.seen:
            return ''
        self.seen.add(digest)
        self.attempts += 1
        suggestion = await asyncio.to_thread(read_local_suggestion, image_bytes) if neural_available else ''
        if not suggestion and Path(exe).is_file():
            pytesseract.pytesseract.tesseract_cmd = exe
            suggestion = await asyncio.to_thread(read_captcha_suggestion, image_bytes,
                                                  min_confidence=90.0, min_agreement=2)
        if not suggestion:
            return 'OCR sonucu yeterince güvenilir veya tutarlı değil. Güvenlik kodunu elle girip Giriş Yap’a basın.'
        # OCR sürerken kullanıcı yazmış, sayfa değişmiş veya kod yenilenmiş olabilir.
        if page.url != url.geturl() or (await fields[0].input_value()).strip():
            return ''
        if hashlib.sha256(await image_content(images[0])).digest() != digest:
            return ''
        # fill tek bir tarayıcı işlemidir; insan girdisini son anda da kontrol et.
        filled = await fields[0].evaluate("""(el, value) => {
            if (el.value.trim() || el.disabled || el.readOnly) return false;
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(el, value);
            el.dispatchEvent(new Event('input', {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
            return true;
        }""", suggestion)
        if not filled:
            return ''
        if self.auto_login:
            buttons = [b for b in await page.get_by_role('button', name=re.compile(r'^\s*giriş\s+yap\s*$', re.I)).all()
                       if await b.is_visible() and await b.is_enabled()]
            passwords = [p for p in await page.locator('input[type="password"]').all() if await p.is_visible()]
            if len(buttons) != 1 or len(passwords) != 1 or not (await passwords[0].input_value()):
                return 'Kod okundu; giriş düğmesi veya hesap alanları hazır değil. Giriş ekranını kontrol edin.'
            if page.url != url.geturl() or await fields[0].input_value() != suggestion:
                return ''
            if hashlib.sha256(await image_content(images[0])).digest() != digest:
                return 'Doğrulama görseli değişti. Giriş gönderilmedi; kodu kontrol edin.'
            # Tıklama zaman aşımına uğrasa da tekrar gönderme: sunucu isteği almış olabilir.
            self.submitted_at = time.monotonic()
            await buttons[0].click(timeout=5000)
            return 'Giriş Yap düğmesine basıldı. Oturum ve sözleşme listesi bekleniyor; başarılı giriş henüz doğrulanmadı.'
        return 'Güvenlik kodu yerel OCR ile önerildi. Kodu kontrol edip gerekirse düzeltin ve Giriş Yap’a basın.'
