"""e-Tebligat listesi (D45): Mert'in canlıda gözlediği uç ve zarf (tebligat-listele, data.tebligatDtoList, pageDetail).
Yalnız liste bilgisi; belge açılmaz. Ayrıştırıcı fail-closed; akış süreç içi sahte GİB'e karşı (canlı GİB değildir, D33)."""
import asyncio
import json
import os
from pathlib import Path

import jsonschema
import pytest
from playwright.async_api import async_playwright

from eworks_integration.core.captcha import CaptchaCozucu
from eworks_integration.institutions.gib.etebligat import EtebligatHatasi, etebligat_listesi_oku, hesap_kimligi_oku, kayit, sayfa_verisi, to_notices
from eworks_integration.institutions.gib.giris import giris_yap
from eworks_integration.transports.robot.tarayici import Tarayici
from tests.sahte_kurumlar import gib as sahte

SOZLESME_KOKU = Path(os.environ['EWORKS_SOZLESMELER']) if 'EWORKS_SOZLESMELER' in os.environ else Path(__file__).resolve().parents[3] / 'contracts'


def satir(i, okundu=False):
    return {'tebligId': f'T{i}', 'belgeNo': f'B-{i}', 'belgeTuruAciklama': 'Ödeme Emri', 'kurumAciklama': 'Vergi Dairesi Başkanlığı', 'altKurum': 'Kadıköy VD',
            'gonderimZamani': '20.10.2026 10:15:00', 'tebligZamani': '25.10.2026 00:00:00' if okundu else None, 'mukellefOkumaZamani': '21.10.2026 09:00:00' if okundu else None}


def yanit(satirlar, toplam=None, sayfa=1, boyut=10):
    toplam = len(satirlar) if toplam is None else toplam
    return {'data': {'tebligatDtoList': satirlar, 'count': toplam}, 'pageDetail': {'pageNo': sayfa, 'pageSize': boyut, 'total': toplam, 'totalPage': -(-toplam // boyut)}}


def test_sayfa_zarfi_dogrulanir_fail_closed():
    satirlar, detay = sayfa_verisi(yanit([satir(1), satir(2)]))
    assert len(satirlar) == 2 and detay['total'] == 2
    for bozuk in ({'data': {}}, yanit([satir(1)], toplam=3) | {'data': {'tebligatDtoList': [satir(1)], 'count': 2}},
                  {'data': {'tebligatDtoList': [], 'count': 0}, 'pageDetail': {'pageNo': 1, 'pageSize': 10, 'total': 0, 'totalPage': 5}}):
        with pytest.raises(EtebligatHatasi):
            sayfa_verisi(bozuk)


@pytest.mark.feature('tebligat.liste.sync')
def test_kayit_eslemesi_kimlik_ozetlenir_tarihler_iso():
    k = kayit(satir(7, okundu=True))
    assert k == {'noticeKey': k['noticeKey'], 'reference': 'B-7', 'documentType': 'Ödeme Emri', 'sender': 'Vergi Dairesi Başkanlığı', 'department': 'Kadıköy VD',
                 'sentOn': '2026-10-20', 'deliveredOn': '2026-10-25', 'readOn': '2026-10-21'}
    assert len(k['noticeKey']) == 64 and 'T7' not in json.dumps(k)
    assert kayit(satir(8))['readOn'] is None
    with pytest.raises(EtebligatHatasi):
        kayit({**satir(1), 'belgeNo': ''})
    with pytest.raises(EtebligatHatasi):
        kayit({**satir(1), 'gonderimZamani': 'dün'})


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


@pytest.mark.feature('tebligat.liste.sync')
def test_firma_hesabiyla_liste_sayfa_sayfa_okunur_kimlik_eslesir_semaya_uyar(sunucu):
    vkn = '9990001112'

    async def isle(ctx):
        sayfa = await ctx.new_page()
        await giris_yap(sayfa, {'username': vkn, 'password': sahte.SIFRE}, CaptchaCozucu())
        kimlik = await hesap_kimligi_oku(sayfa)
        return kimlik, await etebligat_listesi_oku(ctx, sayfa)

    kimlik, kayitlar = calistir(sunucu, isle)
    assert kimlik == vkn
    assert len(kayitlar) == len(sahte.tebligatlar(vkn)) > 10  # birden çok sayfa
    assert len({k['noticeKey'] for k in kayitlar}) == len(kayitlar)
    sonuc = to_notices('11111111-2222-4333-8444-555555555555', '66666666-7777-4888-8999-000000000000', kayitlar, True)
    sema = json.loads((SOZLESME_KOKU / 'integration' / 'eworks.gib.notices.v1.schema.json').read_text(encoding='utf-8'))
    jsonschema.validate(sonuc, sema)
    assert sonuc['documentsOpened'] is False and sonuc['count'] == len(kayitlar)
