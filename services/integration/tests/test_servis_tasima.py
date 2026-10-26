"""Servis erişim yolu (D38; Eworks 2 service_transport): istek kapsamı ve yanıt sınıflaması — tarayıcısız birim testleri.

Alan adları ve uç (`POST /dispatch`, `GET /dispatch?cmd=IMAJ`) Eworks 2'den gelir; Eworks 2 bunlarla 23.10.2026'da canlıda
çalıştı (Mert). Bu uyarlamanın canlı kaydı ayrıca girilir (D33).
"""
from datetime import date
from urllib.parse import urlencode

import pytest

import asyncio

from eworks_integration.core.hatalar import KaynakEngelledi, KaynakYanitHatasi
from eworks_integration.institutions.gib.ebeyanname_servis import (EBEYANNAME, Kapsam, kaynak_adresi, pdf_istegi_mi, sorgu_dogrula,
                                                                   sorgu_istegi_mi, tarih_bicimi, yanit_sinifla)
from eworks_integration.transports.service.http_tasima import ServisTasima, yanit_basliklari

KAPSAM = Kapsam(kimlik='1234567890', esler=('1234567890',), bas=date(2026, 8, 1), bit=date(2026, 8, 31))
URL = 'https://ebeyanname.gib.gov.tr/dispatch'


def govde(**o):
    alanlar = {'TOKEN': 'gizli-belirtec', 'cmd': 'BEYANNAMELISTESI', 'sorguTipiZ': '1', 'baslangicTarihi': '20260801',
               'bitisTarihi': '20260831', 'sorguTipiN': '1', 'vergiNo': '1234567890', **o}
    return urlencode({k: v for k, v in alanlar.items() if v is not None})


@pytest.mark.parametrize('adres, beklenen', [
    (URL, True), (URL + '?cmd=IMAJ', True), ('http://ebeyanname.gib.gov.tr/dispatch', False),
    ('https://ebeyanname.gib.gov.tr:8443/dispatch', False), ('https://x@ebeyanname.gib.gov.tr/dispatch', False),
    ('https://ebeyanname.gib.gov.tr/baska', False), ('https://ebeyanname.gib.gov.tr.saldirgan.com/dispatch', False),
])
def test_yalniz_ebeyanname_dispatch_ucu_kaynak_sayilir(adres, beklenen):
    assert kaynak_adresi(adres) is beklenen


def test_tarih_bicimleri():
    for deger in ('01082026', '20260801', '01.08.2026', '01/08/2026', '2026-08-01', '01-08-2026'):
        assert tarih_bicimi(deger, date(2026, 8, 1))
    with pytest.raises(ValueError):
        tarih_bicimi('02.08.2026', date(2026, 8, 1))


def test_istek_turu_ayrimi():
    assert sorgu_istegi_mi('POST', URL, govde())
    assert not sorgu_istegi_mi('POST', URL, 'TOKEN=x&cmd=SAYFA&sayfa=2')  # sayfalama: tarihsiz, doğrulanmaz, robot yolundan gider
    assert not sorgu_istegi_mi('GET', URL, govde())
    assert pdf_istegi_mi('GET', URL + '?cmd=IMAJ&tur=beyanname&oid=abc')
    assert not pdf_istegi_mi('GET', URL + '?cmd=BASKA')
    assert not pdf_istegi_mi('POST', URL + '?cmd=IMAJ')


def test_gecerli_sorgu_kabul_edilir():
    alanlar = sorgu_dogrula(govde(), KAPSAM)
    assert alanlar['vergiNo'] == '1234567890'
    tc = Kapsam(kimlik='12345678901', esler=('12345678901',), bas=KAPSAM.bas, bit=KAPSAM.bit)
    assert sorgu_dogrula(govde(sorguTipiN=None, vergiNo=None, sorguTipiT='1', tcKimlikNo='12345678901'), tc)['tcKimlikNo'] == '12345678901'


@pytest.mark.parametrize('degisiklik, mesaj', [
    ({'TOKEN': ''}, 'oturum'), ({'cmd': None}, 'oturum'), ({'sorguTipiZ': '0'}, 'oturum'),
    ({'beklenmeyen': '1'}, 'alanları değişti'),
    ({'vergiNo': '9999999999'}, 'mükellef kapsamı'),
    ({'sorguTipiT': '1', 'tcKimlikNo': '12345678901'}, 'VKN/TCKN filtresi'),
    ({'sorguTipiB': '1'}, 'ek filtre'), ({'sorguTipiV': '1'}, 'ek filtre'), ({'sorguTipiD': 'on'}, 'ek filtre'),
    ({'sorguTipiP': '1'}, 'dönem filtresi'),
    ({'bitisTarihi': '20260930'}, 'tarih kapsamı'),
])
def test_kapsam_disi_sorgu_gonderilmez(degisiklik, mesaj):
    with pytest.raises(ValueError, match=mesaj):
        sorgu_dogrula(govde(**degisiklik), KAPSAM)


def test_mukerrer_alan_ve_buyuk_govde_reddedilir():
    with pytest.raises(ValueError, match='alanları değişti'):
        sorgu_dogrula(govde() + '&vergiNo=1234567890', KAPSAM)
    with pytest.raises(ValueError, match='kapsam'):
        sorgu_dogrula(govde() + '&x=' + 'a' * 70000, KAPSAM)


def test_hata_mesajinda_belirtec_ve_govde_yok():
    try:
        sorgu_dogrula(govde(vergiNo='9999999999'), KAPSAM)
    except ValueError as e:
        assert 'gizli-belirtec' not in str(e) and '9999999999' not in str(e)


@pytest.mark.parametrize('durum, sinif, kod', [
    (401, KaynakEngelledi, 'SOURCE_AUTH'), (403, KaynakEngelledi, 'SOURCE_AUTH'), (429, KaynakEngelledi, 'SOURCE_RATE_LIMIT'),
    (500, KaynakYanitHatasi, 'SOURCE_HTTP'), (302, KaynakYanitHatasi, 'SOURCE_HTTP'),
])
def test_yanit_durumu_siniflanir(durum, sinif, kod):
    with pytest.raises(sinif) as h:
        yanit_sinifla(durum, URL, 'text/html', 100, sorgu=True)
    assert h.value.kod == kod


def test_yanit_kaynak_tur_ve_boyut_denetimi():
    yanit_sinifla(200, URL, 'text/html; charset=utf-8', 100, sorgu=True)
    yanit_sinifla(200, URL + '?cmd=IMAJ', 'application/pdf', 5_000_000, sorgu=False)
    yanit_sinifla(200, URL + '?cmd=IMAJ', 'text/html', 1000, sorgu=False)  # "kayıt yok" sayfası: sınıflayıcıya bırakılır
    for durum, adres, tur, boyut, sorgu, kod in (
        (200, 'https://baska.gib.gov.tr/dispatch', 'text/html', 1, True, 'SOURCE_ORIGIN'),
        (200, URL, 'application/json', 1, True, 'SOURCE_FORMAT'),
        (200, URL, 'text/html', 2_000_001, True, 'SOURCE_SIZE'),
        (200, URL, 'application/pdf', 20 * 1024 * 1024 + 1, False, 'SOURCE_SIZE'),
    ):
        with pytest.raises(KaynakYanitHatasi) as h:
            yanit_sinifla(durum, adres, tur, boyut, sorgu=sorgu)
        assert h.value.kod == kod


def test_cozulmus_govdeyle_kodlama_ve_uzunluk_basliklari_iletilmez():
    b = yanit_basliklari({'Content-Type': 'text/html', 'Content-Encoding': 'gzip', 'content-length': '10', 'Transfer-Encoding': 'chunked',
                          'Set-Cookie': 'a=1'})
    assert b == {'Content-Type': 'text/html', 'Set-Cookie': 'a=1'}


class SahteIstek:
    def __init__(self, yontem, url, govde=''):
        self.method, self.url, self.post_data = yontem, url, govde


class SahteRota:
    """Kuruma istek gönderilirse test düşer: doğrulanmayan ya da engellenen istek fetch'e ulaşmamalı."""

    def __init__(self, istek):
        self.request, self.olay = istek, None

    async def fallback(self):
        self.olay = 'robot'

    async def fulfill(self, **k):
        self.olay = ('yanit', k.get('status'))

    async def fetch(self, **_):
        raise AssertionError('kuruma istek gitmemeli')


def isle(tasima, istek):
    rota = SahteRota(istek)
    asyncio.run(tasima._isle(rota))
    return rota.olay


def test_kapsam_disi_sorgu_kuruma_gitmez_ve_hata_kapsam_kodu_tasir():
    t = ServisTasima(None, EBEYANNAME)
    t.kapsam_ac(KAPSAM)
    assert isle(t, SahteIstek('POST', URL, govde(vergiNo='9999999999'))) == ('yanit', 502)
    assert t.hata.kod == 'SOURCE_SCOPE' and t.engel is None
    assert isle(t, SahteIstek('POST', URL, 'TOKEN=x&cmd=SAYFA&sayfa=2')) == 'robot'  # sayfalama robot yolundan
    t.kapsam_kapat()
    assert isle(t, SahteIstek('POST', URL, govde())) == 'robot'  # kapsam kapalı: üstlenilmez


def test_kurum_engeli_kalicidir_sonraki_istek_gonderilmez_ve_ezilmez():
    t = ServisTasima(None, EBEYANNAME)
    t.kapsam_ac(KAPSAM)
    t._hata_koy(KaynakEngelledi('SOURCE_RATE_LIMIT', 'hız'))
    assert isle(t, SahteIstek('GET', URL + '?cmd=IMAJ&oid=x')) == ('yanit', 502)
    assert isle(t, SahteIstek('POST', URL, 'TOKEN=x&cmd=SAYFA&sayfa=2')) == ('yanit', 502)  # sayfalama da durur
    t._hata_koy(KaynakYanitHatasi('SOURCE_HTTP', 'başka'))
    assert t.engel.kod == 'SOURCE_RATE_LIMIT' and t.hata.kod == 'SOURCE_RATE_LIMIT'
    assert t.hata_al().kod == 'SOURCE_RATE_LIMIT' and t.hata_al().kod == 'SOURCE_RATE_LIMIT'


def test_ustlenilmeyen_yanittaki_kurum_engeli_gozlenir():
    t = ServisTasima(None, EBEYANNAME)
    t.kapsam_ac(KAPSAM)
    t._gozle(type('Y', (), {'url': URL, 'status': 200})())
    assert t.engel is None
    t._gozle(type('Y', (), {'url': URL, 'status': 403})())
    assert t.engel.kod == 'SOURCE_AUTH'


def test_hiz_butcesi_doluysa_istek_gitmez_ve_yerel_engel_olur():
    class DoluButce:
        async def izin(self):
            raise TimeoutError()

    t = ServisTasima(None, EBEYANNAME, DoluButce())
    t.kapsam_ac(KAPSAM)
    assert isle(t, SahteIstek('POST', URL, govde())) == ('yanit', 502)
    assert t.engel.kod == 'LOCAL_BUDGET'
