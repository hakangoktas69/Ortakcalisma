"""Robot taşıma yolu (D19: yedek yol): başsız Chromium bağlamı.

- Kuruma giden her belge/XHR isteği merkezi hız sınırlayıcıdan geçer (02 §4). Statik dosyalar bütçeye sayılmaz.
- Demo/test ortamında (GIB_SAHTE_SUNUCU) *.gib.gov.tr istekleri sahte GİB sunucusuna yönlendirilir; robotun gittiği adresler
  ve kurum alanı doğrulaması üretimdekiyle aynıdır. Bu kipte kurum dışına hiçbir istek çıkmaz.
- Şifre, çerez, CAPTCHA ve sayfa içeriği diske yazılmaz; bağlam iş sonunda kapanır.
"""
from __future__ import annotations

import asyncio
import contextlib
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from playwright.async_api import Route

SAYILAN_TURLER = {'document', 'xhr', 'fetch'}
ATLANAN_BASLIKLAR = {'host', 'content-length', 'accept-encoding', 'connection'}


def gib_alani(url: str) -> bool:
    p = urlsplit(url)
    host = (p.hostname or '').lower()
    return p.scheme == 'https' and (host == 'gib.gov.tr' or host.endswith('.gib.gov.tr'))


def sahte_adres(sahte_kok: str, url: str) -> str:
    """https://dijital.gib.gov.tr/portal/login?x → <kök>/dijital/portal/login?x"""
    p = urlsplit(url)
    alt = (p.hostname or '').split('.')[0]
    return f"{sahte_kok.rstrip('/')}/{alt}{p.path}{'?' + p.query if p.query else ''}"


def _sahte_istek(adres: str, yontem: str, basliklar: dict[str, str], govde: bytes | None):
    istek = urllib.request.Request(adres, data=govde, method=yontem, headers={k: v for k, v in basliklar.items() if k.lower() not in ATLANAN_BASLIKLAR})
    try:
        with urllib.request.urlopen(istek, timeout=20) as y:  # noqa: S310 — adres yapılandırmadan, yalnız demo/test
            return y.status, list(y.headers.items()), y.read()
    except urllib.error.HTTPError as h:
        return h.code, list(h.headers.items()), h.read()


class Tarayici:
    def __init__(self, playwright, hiz, sahte_gib: str | None):
        self.playwright = playwright
        self.hiz = hiz
        self.sahte_gib = sahte_gib
        self.browser = None

    async def __aenter__(self):
        self.browser = await self.playwright.chromium.launch(headless=True)
        return self

    async def __aexit__(self, *_):
        with contextlib.suppress(Exception):
            await self.browser.close()

    async def baglam(self):
        ctx = await self.browser.new_context(locale='tr-TR', timezone_id='Europe/Istanbul', viewport={'width': 1366, 'height': 900})
        ctx.set_default_timeout(15000)
        await ctx.route('**/*', self._yonlendir)
        return ctx

    async def _yonlendir(self, route: Route):
        istek = route.request
        if gib_alani(istek.url):
            if istek.resource_type in SAYILAN_TURLER and self.hiz is not None:
                await self.hiz.izin()
            if not self.sahte_gib:
                return await route.continue_()
            basliklar = await istek.all_headers()
            durum, yanit_basliklari, govde = await asyncio.to_thread(_sahte_istek, sahte_adres(self.sahte_gib, istek.url), istek.method, basliklar, istek.post_data_buffer)
            # Set-Cookie birden çok olabilir; Playwright başlık listesini olduğu gibi aktarır
            return await route.fulfill(status=durum, headers=dict(yanit_basliklari), body=govde)
        if self.sahte_gib:
            return await route.abort()  # demo/test: kurum dışına çıkış yok
        return await route.continue_()
