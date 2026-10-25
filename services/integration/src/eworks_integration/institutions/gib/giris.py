"""GİB Dijital Vergi Dairesi girişi: kimlik bilgisi + otomatik CAPTCHA (D6) + sonuç tanıma.

Kimlik alanları eski robotun canlıda kullandığı kuralla bulunur (fill_gib_credentials): yalnız resmî giriş adresinde,
etiketi "kimlik/kullanıcı" olan tek metin alanı ve tek şifre alanı. CAPTCHA pikselleri DOM'a öğe eklemeden okunur.
Hatalı şifre tanınınca hesap bir daha denenmez (05 §4) — bu yüzden şifre hatası ile kod hatası ayrı tutulur.
Not: canlı GİB hata metinleri henüz doğrulanmadı (D33); kalıplar eski kullanıcı belgelerine ve sahte sunucuya göredir.
"""
from __future__ import annotations

import asyncio
import base64
import re
import time
from urllib.parse import urlsplit

GIRIS = 'https://dijital.gib.gov.tr/portal/login'
CAPTCHA_ETIKET = re.compile(r'captcha|güvenlik\s*kodu|guvenlik\s*kodu|doğrulama\s*kodu|dogrulama\s*kodu', re.I)
CAPTCHA_GORSEL = re.compile(r'captcha|security.?code|guvenlik|güvenlik', re.I)
# Arada güvenlik/doğrulama kodu geçmemeli: ekrandaki "Şifre" etiketi ile kod uyarısı yan yana gelebilir; kod hatası
# şifre hatası sanılırsa hesap gereksiz yere durdurulur. Kod hatası önce denetlenir.
SIFRE_HATASI = re.compile(r'(kullanıcı\s*kodu|şifre|parola)(?:(?!güvenlik|doğrulama)[^.]){0,40}hatal|hatal(?:(?!güvenlik|doğrulama)[^.]){0,40}(şifre|parola)', re.I)
KOD_HATASI = re.compile(r'(güvenlik|doğrulama)\s*kodu[^.]{0,40}(hatal|yanlış|geçersiz)', re.I)


class YanlisSifre(Exception):
    """Kurum kullanıcı kodu/şifre hatalı: hesap durdurulur, yeniden denenmez."""


class GirisBasarisiz(Exception):
    """Giriş tamamlanamadı (kod çözülemedi, ekran tanınmadı); iş başarısız sayılır."""


def giris_sayfasinda(url: str) -> bool:
    u = urlsplit(url)
    return (u.scheme, u.hostname, u.path.rstrip('/')) == ('https', 'dijital.gib.gov.tr', '/portal/login')


async def _etiket(alan) -> str:
    return await alan.evaluate("el => [...(el.labels||[])].map(x=>x.innerText).join(' ')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('placeholder')||'')")


async def kimlik_doldur(page, kullanici: str, sifre: str) -> bool:
    if not giris_sayfasinda(page.url):
        return False
    sifreler = [p for p in await page.locator('input[type="password"]').all() if await p.is_visible()]
    kullanicilar = []
    for alan in await page.locator('input').all():
        if not await alan.is_visible():
            continue
        if (await alan.get_attribute('type') or 'text').lower() not in ('text', 'tel', 'number'):
            continue
        etiket = await _etiket(alan)
        if re.search(r'kimlik|kullanıcı|kullanici', etiket, re.I) and not CAPTCHA_ETIKET.search(etiket):
            kullanicilar.append(alan)
    if len(kullanicilar) != 1 or len(sifreler) != 1:
        return False
    await kullanicilar[0].fill(kullanici)
    await sifreler[0].fill(sifre)
    return True


async def _gorsel_baytlari(img) -> bytes:
    veri = await img.evaluate("""el => {
        if (el.tagName === 'CANVAS') return el.toDataURL('image/png');
        if (!el.complete || !el.naturalWidth || el.naturalWidth > 2048 || el.naturalHeight > 2048) return null;
        const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight;
        try { c.getContext('2d').drawImage(el, 0, 0); return c.toDataURL('image/png'); } catch (_) { return null; }
    }""")
    if not veri:
        raise GirisBasarisiz('Güvenlik kodu görseli okunamadı.')
    return base64.b64decode(veri.split(',', 1)[1])


async def _captcha_alani_ve_gorseli(page):
    alanlar = []
    for alan in await page.locator('input').all():
        if not await alan.is_visible() or not await alan.is_editable():
            continue
        if (await alan.get_attribute('type') or 'text').lower() not in ('text', 'tel'):
            continue
        if CAPTCHA_ETIKET.search(await _etiket(alan)):
            alanlar.append(alan)
    gorseller = []
    for img in await page.locator('img,canvas').all():
        if not await img.is_visible():
            continue
        tanim = ' '.join([(await img.get_attribute(a)) or '' for a in ('alt', 'aria-label', 'id', 'class', 'src')])
        if CAPTCHA_GORSEL.search(tanim):
            gorseller.append(img)
    if len(alanlar) != 1 or len(gorseller) != 1:
        raise GirisBasarisiz('Giriş ekranında tek bir güvenlik kodu alanı ve görseli tanınamadı.')
    return alanlar[0], gorseller[0]


MESAJ_SECICI = '[role=alert],[role=alertdialog],.alert,.toast,[class*="error" i],[class*="hata" i],[class*="message" i]'


async def _mesaj_metni(page) -> str:
    """Önce uyarı öğeleri okunur; alan etiketleri ("Şifre", "Güvenlik Kodu") uyarıyla karışmasın diye gövde en son."""
    try:
        parcalar = [await m.inner_text(timeout=1000) for m in await page.locator(MESAJ_SECICI).all() if await m.is_visible()]
        metin = ' '.join(' '.join(parcalar).split())
        return metin or ' '.join((await page.locator('body').inner_text(timeout=2000)).split())
    except Exception:  # sayfa geçişi sırasında belge değişmiş olabilir
        return ''


def siniflandir(metin: str) -> str | None:
    if KOD_HATASI.search(metin):
        return 'kod'
    if SIFRE_HATASI.search(metin):
        return 'sifre'
    return None


async def _sonuc_bekle(page, gonderim: asyncio.Event, sure_sn: float) -> str:
    """'tamam' | 'sifre' | 'kod' | 'bilinmiyor'. Önceki denemeden kalan uyarı yeniden sayılmasın diye ekran ancak
    gönderimin (GET dışı istek ya da sayfa geçişi) yanıtı geldikten sonra okunur."""
    bitis = time.monotonic() + sure_sn
    while time.monotonic() < bitis:
        if not giris_sayfasinda(page.url):
            return 'tamam'
        if gonderim.is_set() and (sonuc := siniflandir(await _mesaj_metni(page))):
            return sonuc
        await asyncio.sleep(0.3)
    return 'bilinmiyor'


async def giris_yap(page, kimlik: dict, cozucu, ilerleme=None, deneme_siniri: int = 6) -> str:
    """Başarıda girişten sonraki adresi döner (uygulama seçim ekranı); hatalı şifrede YanlisSifre, diğer durumlarda GirisBasarisiz fırlatır. Kimlik sözlüğü sonda temizlenir."""
    try:
        await page.goto(GIRIS, wait_until='domcontentloaded')
        for deneme in range(1, deneme_siniri + 1):
            if not await kimlik_doldur(page, kimlik['username'], kimlik['password']):
                raise GirisBasarisiz('Giriş ekranındaki kullanıcı kodu ve şifre alanları tanınamadı.')
            alan, gorsel = await _captcha_alani_ve_gorseli(page)
            kod = await asyncio.to_thread(cozucu.coz, await _gorsel_baytlari(gorsel))
            if not kod:
                # Güvenilir olmayan okuma gönderilmez; sayfa yenilenip yeni kod istenir
                await page.goto(GIRIS, wait_until='domcontentloaded')
                continue
            await alan.fill(kod)
            dugmeler = [b for b in await page.get_by_role('button', name=re.compile(r'^\s*giriş\s+yap\s*$', re.I)).all() if await b.is_visible() and await b.is_enabled()]
            if len(dugmeler) != 1:
                raise GirisBasarisiz('Giriş düğmesi tanınamadı.')
            gonderim = asyncio.Event()

            def _bitti(istek, olay=gonderim):
                if istek.method != 'GET' or istek.is_navigation_request():
                    olay.set()
            page.on('requestfinished', _bitti)
            page.on('requestfailed', _bitti)
            try:
                await dugmeler[0].click(timeout=5000)
                sonuc = await _sonuc_bekle(page, gonderim, 15)
            finally:
                page.remove_listener('requestfinished', _bitti)
                page.remove_listener('requestfailed', _bitti)
            if sonuc == 'tamam':
                return page.url
            if sonuc == 'sifre':
                raise YanlisSifre()
            if ilerleme:
                await ilerleme(f'Güvenlik kodu tekrar deneniyor ({deneme}/{deneme_siniri}).')
            if sonuc == 'bilinmiyor':
                await page.goto(GIRIS, wait_until='domcontentloaded')
        raise GirisBasarisiz('Güvenlik kodu otomatik çözülemedi; iş daha sonra yeniden denenebilir.')
    finally:
        kimlik.clear()
