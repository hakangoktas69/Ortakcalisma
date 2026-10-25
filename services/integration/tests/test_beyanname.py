"""e-Beyanname: liste kuralları (tarayıcısız) ve uçtan uca tarama (gerçek tarayıcı → süreç içi sahte GİB; canlı GİB değildir, D33)."""
import asyncio
import json
import os
from datetime import date
from pathlib import Path

import jsonschema
import pytest
from playwright.async_api import async_playwright

from eworks_integration.core.captcha import CaptchaCozucu
from eworks_integration.institutions.gib.beyannameler import (BeyannameHatasi, aylik_kapsam, beyanname_tara, erisim_kaniti, kaynak_kimligi,
                                                              pdf_dogrula, satirlari_dogrula, to_declarations)
from eworks_integration.institutions.gib.giris import giris_yap
from eworks_integration.institutions.gib.sozlesmeler import sozlesme_listesi_oku
from eworks_integration.transports.robot.tarayici import Tarayici
from tests.sahte_kurumlar import ebeyanname as sahte_ebyn
from tests.sahte_kurumlar import gib as sahte

KOK = Path(os.environ['EWORKS_SOZLESMELER']) if 'EWORKS_SOZLESMELER' in os.environ else Path(__file__).resolve().parents[3] / 'contracts'
SEMA = json.loads((KOK / 'integration' / 'eworks.gib.declarations.v1.schema.json').read_text(encoding='utf-8'))
JOB = '11111111-2222-4333-8444-555555555555'
ORG = '66666666-7777-4888-8999-000000000000'
KULLANICI = '55507777'


def satir(**o):
    return {'identity': '1234567890', 'sourceRowId': 'abcdef0123456789abcd', 'document': 'KDV1', 'period': '08/2026-08/2026', 'branch': '0',
            'uploadedAt': '24.09.2026 - 10:11:12', 'taxStatus': 'Onaylandı', 'sgkStatus': '', 'sourceFilename': '1234567890_KDV1_202608_abcdef01.xml', **o}


EYLUL = {'kimlik': '1234567890', 'esler': ['1234567890'], 'bas': date(2026, 9, 1), 'bit': date(2026, 9, 30)}


def test_liste_satiri_dogrulanir_ve_yayimlanmis_dile_cevrilir():
    [k] = satirlari_dogrula([satir()], **EYLUL)
    assert (k['type'], k['periodStart'], k['periodEnd'], k['referenceType']) == ('KDV1', '2026-08', '2026-08', 'source_filename')
    assert k['uploadedAt'] == '2026-09-24T10:11:12+03:00'


@pytest.mark.parametrize('bozuk, mesaj', [
    ({'identity': '9999999999'}, 'Başka mükellef'),
    ({'uploadedAt': '24.10.2026 - 10:11:12'}, 'aralığı dışında'),
    ({'period': '09/2026-08/2026'}, 'dönemi'),
    ({'document': 'kdv 1'}, 'türü'),
    ({'sourceFilename': 'baskasi_KDV1.xml'}, 'referansı'),
    ({'sourceRowId': 'a b'}, 'karakter'),
])
def test_dogrulanmayan_satir_listeyi_durdurur(bozuk, mesaj):
    with pytest.raises(BeyannameHatasi, match=mesaj):
        satirlari_dogrula([satir(**bozuk)], **EYLUL)


def test_mukerrer_satir_ve_xml_adi_olmayan_kalici_kimlik():
    with pytest.raises(BeyannameHatasi, match='mükerrer'):
        satirlari_dogrula([satir(), satir()], **EYLUL)
    [k] = satirlari_dogrula([satir(sourceFilename='')], **EYLUL)
    assert (k['reference'], k['referenceType']) == ('abcdef0123456789abcd', 'source_record_id')
    assert kaynak_kimligi('ab%2Fcd').startswith('encoded-')


def test_erisim_yalniz_aracilik_ve_sorumluluk_sozlesmesiyle():
    k = erisim_kaniti([
        {'taxNumber': '1234567890', 'identityNumber': '', 'number': 'S-1', 'type': 'Aracılık ve Sorumluluk Sözleşmesi'},
        {'taxNumber': '2234567890', 'identityNumber': '', 'number': 'S-2', 'type': 'Yalnız Aracılık Sözleşmesi'},
        {'taxNumber': '', 'identityNumber': '99123456789', 'number': 'S-3', 'type': 'ELEKTRONİK BEYANNAME ARACILIK VE SORUMLULUK SÖZLEŞMESİ'},
    ])
    assert sorted(k) == ['1234567890', '99123456789']
    assert k['1234567890']['contractNumbers'] == ['S-1']


def test_aylik_kapsam_ve_pdf_dogrulama():
    assert aylik_kapsam(date(2026, 8, 15), date(2026, 10, 3)) == [
        (date(2026, 8, 15), date(2026, 8, 31)), (date(2026, 9, 1), date(2026, 9, 30)), (date(2026, 10, 1), date(2026, 10, 3))]
    assert len(pdf_dogrula(sahte_ebyn.pdf(['deneme']))) == 64
    with pytest.raises(BeyannameHatasi):
        pdf_dogrula(b'<html>Kayit yok</html>' * 10)


@pytest.fixture(scope='module')
def sunucu():
    s = sahte.baslat(0)
    yield f'http://127.0.0.1:{s.server_address[1]}'
    s.shutdown()


def test_ayni_oturumda_sozlesme_sonra_beyanname_ve_pdfler(sunucu):
    """Sözleşmeli şirket mükellefi, Ağustos 2026 (KDV1 + MUHSGK + KGEÇİCİ = 3 kayıt; sayfa boyu 2 → sayfalama sınanır)."""
    sozlesmeler = sahte.sozlesmeler(KULLANICI)
    hedef = next(s for s in sozlesmeler if s['taxNumber'] and s['type'].startswith('Aracılık'))
    yok = next((s for s in sozlesmeler if s['type'].startswith('Yalnız')), None)
    beklenen = sahte_ebyn.sorgu(sahte_ebyn.beyannameler(hedef['taxNumber'], hedef['name'], hedef['taxOffice']), date(2026, 8, 1), date(2026, 8, 31))
    assert len(beklenen) > sahte_ebyn.SAYFA
    depo: dict[str, bytes] = {}

    async def kaydet(ozet, ham):
        depo[ozet] = ham
        return f'org/{ORG}/belgeler/{ozet}.pdf'

    async def ic():
        async with async_playwright() as p, Tarayici(p, None, sunucu) as t:
            ctx = await t.baglam()
            try:
                ana = await giris_yap(await ctx.new_page(), {'username': KULLANICI, 'password': sahte.SIFRE}, CaptchaCozucu())
                okunan = await sozlesme_listesi_oku(ctx)
                kimlikler = [hedef['taxNumber']] + ([yok['taxNumber'] or yok['identityNumber']] if yok else [])
                kapsam = {'startDate': '2026-08-01', 'endDate': '2026-08-31', 'identities': kimlikler}
                return okunan, kapsam, await beyanname_tara(ctx, ana, okunan, kapsam, kaydet)
            finally:
                await ctx.close()

    okunan, kapsam, sorgular = asyncio.run(ic())
    tamam = next(q for q in sorgular if q['identity'] == hedef['taxNumber'])
    assert tamam['outcome'] == 'ok' and tamam['access']['contractNumbers'] == [hedef['number']]
    assert sorted(r['recordId'] for r in tamam['records']) == sorted(k['oid'] for k in beklenen)
    assert all({d['kind'] for d in r['documents']} == {'declaration', 'tax_accrual'} for r in tamam['records'])
    assert len(depo) == 2 * len(beklenen)
    if yok:
        assert next(q for q in sorgular if q['identity'] != hedef['taxNumber'])['outcome'] == 'no_access'
    jsonschema.validate(to_declarations(JOB, okunan, kapsam, sorgular, sahte=True), SEMA, format_checker=jsonschema.FormatChecker())


def test_kayit_olmayan_ay_bos_sonuctur_hata_degil(sunucu):
    sozlesmeler = sahte.sozlesmeler(KULLANICI)
    hedef = next(s for s in sozlesmeler if s['taxNumber'] and s['type'].startswith('Aracılık'))

    async def ic():
        async with async_playwright() as p, Tarayici(p, None, sunucu) as t:
            ctx = await t.baglam()
            try:
                ana = await giris_yap(await ctx.new_page(), {'username': KULLANICI, 'password': sahte.SIFRE}, CaptchaCozucu())
                okunan = await sozlesme_listesi_oku(ctx)
                # 1-5 Ocak 2025: sahte veride yükleme günü 10-26 → kayıt yok
                return await beyanname_tara(ctx, ana, okunan, {'startDate': '2025-01-01', 'endDate': '2025-01-05', 'identities': [hedef['taxNumber']]},
                                            None)
            finally:
                await ctx.close()

    [q] = asyncio.run(ic())
    assert (q['outcome'], q['records']) == ('empty', [])
