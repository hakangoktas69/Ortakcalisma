"""GİB ekran adaptörü. Seçiciler canlı ekrandan doğrulanmadan çalıştırılmaz."""
from __future__ import annotations

import asyncio
import re
import shutil
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Awaitable, Callable
from urllib.parse import urlsplit
from uuid import UUID

import pytesseract
import cv2
import numpy as np
from PIL import Image
from playwright.async_api import Page, expect

from logger_service import LoggerService

FIELDS = ("taxNumber", "identityNumber", "name", "taxOffice", "number",
          "date", "service", "registeredAt", "type")
ConfirmCaptcha = Callable[[Page, str], Awaitable[bool]]
OCR_CONFIG = ('--psm 6 --oem 3 -c tessedit_char_whitelist='
              '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')


def captcha_image_variants(image_bytes: bytes):
    """Aynı görselden bellekte en fazla dört siyah-beyaz aday üretir.

    Uzun düz çizgi maskeleri harfleri de etkileyebilir. Bu işlem çizgi
    temizliğini veya OCR doğruluğunu garanti etmez; insan kontrolü korunur.
    """
    if not image_bytes or len(image_bytes) > 2_000_000:
        raise ValueError('OCR görüntüsü boş veya çok büyük.')
    with Image.open(BytesIO(image_bytes)) as image:
        width, height = image.size
        if min(width, height) < 5 or max(width, height) > 2048 or width * height > 1_000_000:
            raise ValueError('OCR görüntü boyutu desteklenmiyor.')
        rgba = image.convert('RGBA')
        background = Image.new('RGBA', rgba.size, 'white')
        rgb = np.asarray(Image.alpha_composite(background, rgba).convert('RGB'))
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    # OTSU ilk adaydır; diğerleri farklı kontrast ve yerel eşikleme kullanır.
    for alpha, offset in ((1.0, None), (1.2, 7), (1.5, 11), (0.85, 3)):
        contrast = cv2.convertScaleAbs(gray, alpha=alpha)
        if offset is None:
            _, foreground = cv2.threshold(contrast, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
        else:
            foreground = cv2.adaptiveThreshold(contrast, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                               cv2.THRESH_BINARY_INV, 31, offset)
        h, w = foreground.shape
        horizontal = cv2.morphologyEx(foreground, cv2.MORPH_OPEN,
                                     cv2.getStructuringElement(cv2.MORPH_RECT, (max(30, w//3), 1)))
        vertical = cv2.morphologyEx(foreground, cv2.MORPH_OPEN,
                                   cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(30, int(h*.9)))))
        cleaned = cv2.bitwise_and(foreground, cv2.bitwise_not(cv2.bitwise_or(horizontal, vertical)))
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        cleaned = cv2.GaussianBlur(cleaned, (3, 3), 0.5)
        _, cleaned = cv2.threshold(cleaned, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        yield cv2.copyMakeBorder(cv2.bitwise_not(cleaned), 12, 12, 12, 12,
                                 cv2.BORDER_CONSTANT, value=255)


def read_captcha_suggestion(image_bytes: bytes, *, max_attempts=4,
                            min_confidence=70.0, expected_length=None) -> str:
    """Yerel OCR önerisi. Yeni CAPTCHA istemez; giriş veya ağ denemesi yapmaz."""
    if type(max_attempts) is not int or not 1 <= max_attempts <= 4:
        raise ValueError('OCR deneme sayısı 1–4 arasında olmalı.')
    if not 0 <= min_confidence <= 100:
        raise ValueError('OCR güven eşiği geçersiz.')
    if expected_length is not None and (type(expected_length) is not int or not 1 <= expected_length <= 16):
        raise ValueError('Beklenen karakter sayısı geçersiz.')
    best_text, best_confidence = '', -1.0
    for attempt, variant in enumerate(captcha_image_variants(image_bytes)):
        if attempt >= max_attempts:
            break
        try:
            result = pytesseract.image_to_data(variant, config=OCR_CONFIG,
                                               output_type=pytesseract.Output.DICT, timeout=3)
            tokens = [(str(t).strip(), float(c)) for t, c in zip(result['text'], result['conf'])
                      if str(t).strip() and float(c) >= 0]
            text = ''.join(t for t, _ in tokens)
            if not re.fullmatch(r'[A-Za-z0-9]{1,16}', text):
                continue
            if expected_length is not None:
                if len(text) != expected_length:
                    continue
            elif not 4 <= len(text) <= 8:
                continue
            confidence = sum(len(t)*c for t,c in tokens)/len(text)
            if confidence > best_confidence:
                best_text, best_confidence = text, confidence
            if confidence >= min_confidence:
                break
        except (RuntimeError, OSError, KeyError, ValueError, TypeError):
            continue
    return best_text


@dataclass(frozen=True)
class GibSelectors:
    # Hiçbir değer uydurulmaz: gerçek ekrandan alınmış CSS seçicileri gerekir.
    username: str
    password: str
    captcha_image: str
    captcha_input: str
    login_button: str
    login_success: str
    list_heading: str
    table: str
    headers: tuple[str, ...]  # gerçek tablodaki başlıklar, gerçek sıralarıyla
    columns: dict[str, int]  # FIELDS alanı -> sıfırdan başlayan td indeksi
    next_button: str = ""
    frame: str = ""  # tablo iframe içindeyse doğrulanmış iframe seçicisi

    def validate(self, require_login: bool = True) -> None:
        values = (self.list_heading, self.table)
        if require_login:
            values += (self.username, self.password, self.captcha_image,
                       self.captcha_input, self.login_button, self.login_success)
        if any(not v or "TODO" in v or "_field_id" in v for v in values):
            raise ValueError("Gerçek GİB seçicileri henüz yapılandırılmadı.")
        if (set(self.columns) != set(FIELDS) or len(self.headers) < 9
                or any(type(v) is not int or v < 0 or v >= len(self.headers)
                       for v in self.columns.values())
                or len(set(self.columns.values())) != len(FIELDS)):
            raise ValueError("Dokuz sözleşme sütunu için geçerli eşleme gerekli.")


def _check_origin(page: Page) -> None:
    parsed = urlsplit(page.url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not (host == "gib.gov.tr" or host.endswith(".gib.gov.tr")):
        raise ValueError("Sayfa doğrulanmış HTTPS GİB alanında değil.")


def validate_contracts(contracts: list[dict], expected_count: int, musavir_id: str) -> None:
    owner = str(UUID(musavir_id))
    if type(expected_count) is not int or expected_count <= 0 or len(contracts) != expected_count:
        raise ValueError("GİB toplamı ile satır sayısı uyuşmuyor veya liste boş.")
    seen = set()
    for record in contracts:
        if record.get("musavir_id") != owner or any(not isinstance(record.get(k), str) for k in FIELDS):
            raise ValueError("Kayıt sahibi veya sözleşme alanları geçersiz.")
        vkn, tckn = record["taxNumber"], record["identityNumber"]
        if ((not vkn and not tckn) or (vkn and not re.fullmatch(r"[0-9]{10}", vkn))
                or (tckn and not re.fullmatch(r"[0-9]{11}", tckn))):
            raise ValueError("Geçersiz VKN/TCKN.")
        if not record["name"].strip() or not record["number"].strip():
            raise ValueError("Unvan veya sözleşme numarası eksik.")
        key = (vkn or tckn, record["number"])
        if key in seen:
            raise ValueError("Tekrarlanan sözleşme; aktarım durduruldu.")
        seen.add(key)


async def solve_captcha_and_login(
    page: Page, vkn: str, sifre: str, musavir_id: str, *,
    selectors: GibSelectors, logger: LoggerService,
    confirm_captcha: ConfirmCaptcha, use_ocr: bool = False,
) -> bool:
    """OCR yalnızca öneri üretir; kullanıcı kontrolü olmadan giriş gönderilmez."""
    selectors.validate()
    try:
        await page.goto("https://dijital.gib.gov.tr/portal/login", wait_until="domcontentloaded")
        _check_origin(page)
        await page.locator(selectors.username).fill(vkn)
        await page.locator(selectors.password).fill(sifre)
        suggestion = ""
        if use_ocr:
            try:
                exe = shutil.which("tesseract") or r"C:\Program Files\Tesseract-OCR\tesseract.exe"
                if not Path(exe).is_file():
                    raise FileNotFoundError("Tesseract bulunamadı.")
                pytesseract.pytesseract.tesseract_cmd = exe
                image_bytes = await page.locator(selectors.captcha_image).screenshot()
                suggestion = await asyncio.to_thread(read_captcha_suggestion, image_bytes)
            except Exception:
                # OCR hatasında manuel giriş yolu kullanılabilir. Kalıcı görsel/log
                # oluşturulmaz; pytesseract kendi geçici dosyalarını temizler.
                suggestion = ""
        await asyncio.to_thread(logger.write_log, musavir_id, "GİB Giriş", "BEKLİYOR",
                                "Güvenlik kodunun kullanıcı tarafından kontrolü bekleniyor.")
        # Callback kodu tarayıcıdaki alana insanın girmesini/düzeltmesini bekler.
        if not await confirm_captcha(page, suggestion):
            return False
        _check_origin(page)
        if not (await page.locator(selectors.captcha_input).input_value()).strip():
            return False
        await page.locator(selectors.login_button).click()
        await page.locator(selectors.login_success).wait_for(state="visible", timeout=60000)
        _check_origin(page)
        await asyncio.to_thread(logger.write_log, musavir_id, "GİB Giriş", "BAŞARILI", "Oturum doğrulandı.")
        return True
    except Exception as exc:
        await asyncio.to_thread(logger.write_log, musavir_id, "GİB Giriş", "HATA",
                                f"Giriş tamamlanamadı ({type(exc).__name__}).")
        return False


async def scrape_contract_table(
    page: Page, musavir_id: str, *, selectors: GibSelectors,
    expected_count: int, logger: LoggerService,
) -> list[dict]:
    """Kullanıcının açtığı geçerli sözleşme listesini, tüm sayfalarıyla okur.

    Menülerin popup/iframe yapısı doğrulanmadığı için otomatik menü gezintisi yok.
    Hata boş listeye çevrilmez: çağıran kod yazma aşamasına geçemez.
    """
    selectors.validate(require_login=False)
    owner = str(UUID(musavir_id))
    if type(expected_count) is not int or expected_count <= 0:
        raise ValueError("GİB ekranındaki güncel toplam kayıt sayısı gerekli.")
    root = page.frame_locator(selectors.frame) if selectors.frame else page
    contracts: list[dict] = []
    try:
        _check_origin(page)
        await expect(root.locator(selectors.list_heading)).to_have_text(
            "Geçerli E-Beyanname Sözleşmeleri Listesi", timeout=15000)
        table = root.locator(selectors.table)
        await table.wait_for(state="visible", timeout=15000)
        page_signatures = set()
        for _ in range(expected_count + 1):
            _check_origin(page)
            actual_headers = tuple(t.strip() for t in await table.locator("tr").first.locator("th,td").all_inner_texts())
            if actual_headers != selectors.headers:
                raise ValueError("Tablo başlıkları değişti; sütun eşlemesi yeniden doğrulanmalı.")
            snapshot = await table.inner_text()
            if snapshot in page_signatures:
                raise ValueError("Aynı tablo sayfası tekrar okundu.")
            page_signatures.add(snapshot)
            rows = await table.locator("tr").all()
            for row in rows[1:]:
                cells = await row.locator("td").all_inner_texts()
                if not cells:
                    continue
                if len(cells) != len(selectors.headers):
                    # Tam genişlikteki bilinen sayfalama alt bilgisi veri değildir.
                    paging = re.search(r'\d+\s*-\s*\d+\s+listeleniyor\.?\s*Toplam\s*:\s*\d+',
                                       ' '.join(cells), re.I)
                    colspan = await row.locator('td').first.get_attribute('colspan')
                    if len(cells) == 1 and colspan == str(len(selectors.headers)) and paging:
                        continue
                    raise ValueError("Beklenmeyen tablo satırı veya sütun sayısı.")
                record = {field: cells[index].strip() for field, index in selectors.columns.items()}
                for field in ("taxNumber", "identityNumber"):
                    if record[field] in ("-", "-----"):
                        record[field] = ""
                record["musavir_id"] = owner
                contracts.append(record)
            if len(contracts) >= expected_count:
                break
            if not selectors.next_button:
                raise ValueError("Liste eksik; sonraki sayfa seçicisi gerekli.")
            next_button = root.locator(selectors.next_button)
            if (await next_button.get_attribute("aria-disabled") == "true"
                    or re.search(r"\bdisabled\b", await next_button.get_attribute("class") or "")):
                raise ValueError("Liste eksik; sonraki sayfa düğmesi devre dışı.")
            await expect(next_button).to_be_enabled(timeout=15000)
            await next_button.click()
            deadline = asyncio.get_running_loop().time() + 15
            while await table.inner_text() == snapshot:
                if asyncio.get_running_loop().time() >= deadline:
                    raise TimeoutError("Sonraki tablo sayfası yüklenmedi.")
                await asyncio.sleep(0.2)  # yüklenme durumunu bekler; gizleme amacı yok
        validate_contracts(contracts, expected_count, owner)
        await asyncio.to_thread(logger.write_log, owner, "Veri Kazıma", "BAŞARILI",
                                f"{len(contracts)} sözleşme doğrulandı.")
        return contracts
    except Exception as exc:
        await asyncio.to_thread(logger.write_log, owner, "Veri Kazıma", "HATA",
                                f"Liste doğrulanamadı ({type(exc).__name__}); kayıt yapılmayacak.")
        raise
