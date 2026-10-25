"""Robot akışı: gerçek GİB adresleri → tarayıcı yönlendirmesi → süreç içi sahte GİB (canlı GİB değildir, D33)."""
import asyncio

import pytest
from playwright.async_api import async_playwright

from eworks_integration.core.captcha import CaptchaCozucu
from eworks_integration.institutions.gib.gezinme import BelirsizHedef, visible_target
from eworks_integration.institutions.gib.giris import GirisBasarisiz, YanlisSifre, giris_yap
from eworks_integration.institutions.gib.sozlesmeler import sozlesme_listesi_oku
from eworks_integration.transports.robot.tarayici import Tarayici
from tests.sahte_kurumlar import gib as sahte


@pytest.fixture(scope='module')
def sunucu():
    s = sahte.baslat(0)
    yield f'http://127.0.0.1:{s.server_address[1]}'
    s.shutdown()


def calistir(kok, isle):
    async def ic():
        async with async_playwright() as p, Tarayici(p, None, kok) as t:
            ctx = await t.baglam()
            try:
                return await isle(ctx)
            finally:
                await ctx.close()
    return asyncio.run(ic())


class YanlisSonraDogru(CaptchaCozucu):
    """İlk okumayı bilerek bozar: robotun kod hatasını tanıyıp yeniden denediği sınanır."""

    def __init__(self):
        super().__init__()
        self.sayac = 0

    def coz(self, png):
        self.sayac += 1
        return '00000' if self.sayac == 1 else super().coz(png)


def test_dogru_sifreyle_listenin_tamami_okunur(sunucu):
    ilerlemeler = []

    async def isle(ctx):
        async def kaydet(m):
            ilerlemeler.append(m)
        await giris_yap(await ctx.new_page(), {'username': '55501234', 'password': sahte.SIFRE}, CaptchaCozucu(), kaydet)
        return await sozlesme_listesi_oku(ctx, kaydet)

    kayitlar = calistir(sunucu, isle)
    assert kayitlar == sahte.sozlesmeler('55501234')
    assert any('İVD yönlendirme onayı' in m for m in ilerlemeler)
    assert any('E-Beyanname Yetki Bilgileri' in m for m in ilerlemeler)


def test_hatali_sifre_taninir_ve_kimlik_temizlenir(sunucu):
    kimlik = {'username': '55501234', 'password': 'yanlis-sifre'}

    async def isle(ctx):
        await giris_yap(await ctx.new_page(), kimlik, CaptchaCozucu())

    with pytest.raises(YanlisSifre):
        calistir(sunucu, isle)
    assert kimlik == {}


def test_yanlis_okunan_guvenlik_kodunda_yeniden_denenir(sunucu):
    cozucu = YanlisSonraDogru()

    async def isle(ctx):
        sayfa = await ctx.new_page()
        await giris_yap(sayfa, {'username': '55509999', 'password': sahte.SIFRE}, cozucu)
        return sayfa.url

    assert calistir(sunucu, isle) == 'https://dijital.gib.gov.tr/portal/anasayfa'
    assert cozucu.sayac >= 2


def test_cozulemeyen_kodda_sinirli_deneme(sunucu):
    class Hep(CaptchaCozucu):
        def coz(self, png):
            return ''

    async def isle(ctx):
        await giris_yap(await ctx.new_page(), {'username': '1', 'password': sahte.SIFRE}, Hep(), deneme_siniri=2)

    with pytest.raises(GirisBasarisiz):
        calistir(sunucu, isle)


def test_sahte_kipte_kurum_disina_istek_cikmaz(sunucu):
    async def isle(ctx):
        sayfa = await ctx.new_page()
        try:
            await sayfa.goto('https://example.com/', timeout=5000)
        except Exception as e:  # noqa: BLE001
            return type(e).__name__
        return 'gitti'

    assert calistir(sunucu, isle) != 'gitti'


def test_belirsiz_hedefe_tiklanmaz(sunucu):
    """Eski navigasyon testi: aynı metinde iki tıklanabilir hedef varsa robot durur."""
    async def isle(ctx):
        sayfa = await ctx.new_page()
        await ctx.unroute('**/*')
        await ctx.route('**/*', lambda r: r.fulfill(body='<meta charset="utf-8"><a href="#1">Tümünü Göster</a><a href="#2">Tümünü Göster</a>', content_type='text/html'))
        await sayfa.goto('https://intvrg.gib.gov.tr/x')
        await visible_target(ctx, 'Tümünü Göster')

    with pytest.raises(BelirsizHedef):
        calistir(sunucu, isle)
