"""Otomatik CAPTCHA (D6): sunucu OCR'ı (ddddocr). Güvenli olmayan sonuç boş döner; çağıran yeni kod ister.
Görsel ve kod diske ya da günlüğe yazılmaz."""
from __future__ import annotations

import io
import re

from PIL import Image


class CaptchaCozucu:
    def __init__(self):
        self._motor = None

    def _ocr(self):
        if self._motor is None:
            import ddddocr  # ağır bağımlılık: ilk kullanımda yüklenir
            self._motor = ddddocr.DdddOcr(show_ad=False)
        return self._motor

    def coz(self, png: bytes) -> str:
        if not png or len(png) > 2_000_000:
            return ''
        with Image.open(io.BytesIO(png)) as img:
            w, h = img.size
            if min(w, h) < 5 or max(w, h) > 2048 or w * h > 1_000_000:
                return ''
        metin = (self._ocr().classification(png) or '').strip()
        return metin if re.fullmatch(r'[A-Za-z0-9]{4,8}', metin) else ''
