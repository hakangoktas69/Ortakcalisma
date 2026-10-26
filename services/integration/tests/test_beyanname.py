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
from eworks_integration.institutions.gib.muhsgk import calisan_sayisi
from eworks_integration.institutions.gib.sozlesmeler import sozlesme_listesi_oku
from eworks_integration.transports.robot.tarayici import Tarayici
from eworks_integration.institutions.gib.ebeyanname_servis import EBEYANNAME
from eworks_integration.transports.service.http_tasima import ServisTasima
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


def test_hizmet_listesinden_calisan_sayisi():
    k = {'kimlik': '1234567890', 'oid': 'x'}
    s = {'oid': 'sgk1', 'isyeri': '1' * 26, 'donem': '08/2026'}
    assert calisan_sayisi(sahte_ebyn.hizmet_pdf(k, s)) == len(sahte_ebyn.calisanlar('1234567890', 'sgk1'))
    assert calisan_sayisi(sahte_ebyn.pdf(['baska bir belge'])) is None


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


async def tara(sunucu, erisim, kapsam, belge_kaydet):
    """Giriş + sözleşme listesi robotla (iki yolda da, Eworks 2 gibi); beyanname sorgusu ve PDF'ler seçilen erişim yoluyla (D38)."""
    async with async_playwright() as p, Tarayici(p, None, sunucu) as t:
        ctx = await t.baglam()
        tasima = ServisTasima(ctx, EBEYANNAME, None, sunucu) if erisim == 'servis' else None
        try:
            if tasima:
                await tasima.bagla()
            ana = await giris_yap(await ctx.new_page(), {'username': KULLANICI, 'password': sahte.SIFRE}, CaptchaCozucu())
            okunan = await sozlesme_listesi_oku(ctx)
            return okunan, await beyanname_tara(ctx, ana, okunan, kapsam, belge_kaydet, tasima=tasima), tasima
        finally:
            await ctx.close()


@pytest.mark.parametrize('erisim', ['robot', 'servis'])
def test_ayni_oturumda_sozlesme_sonra_beyanname_ve_pdfler(sunucu, erisim):
    """Sözleşmeli şirket mükellefi, Ağustos 2026 (KDV1 + MUHSGK + KGEÇİCİ = 3 kayıt; sayfa boyu 2 → sayfalama sınanır).
    İki erişim yolu aynı sonucu üretir; servis yolunda sorgu ve PDF'ler aynı oturumun HTTP taşımasından geçer (D38)."""
    sozlesmeler = sahte.sozlesmeler(KULLANICI)
    hedef = next(s for s in sozlesmeler if s['taxNumber'] and s['type'].startswith('Aracılık'))
    yok = next((s for s in sozlesmeler if s['type'].startswith('Yalnız')), None)
    beklenen = sahte_ebyn.sorgu(sahte_ebyn.beyannameler(hedef['taxNumber'], hedef['name'], hedef['taxOffice']), date(2026, 8, 1), date(2026, 8, 31))
    assert len(beklenen) > sahte_ebyn.SAYFA
    depo: dict[str, bytes] = {}

    async def kaydet(ozet, ham):
        depo[ozet] = ham
        return f'org/{ORG}/belgeler/{ozet}.pdf'

    kimlikler = [hedef['taxNumber']] + ([yok['taxNumber'] or yok['identityNumber']] if yok else [])
    kapsam = {'startDate': '2026-08-01', 'endDate': '2026-08-31', 'identities': kimlikler}
    okunan, sorgular, tasima = asyncio.run(tara(sunucu, erisim, kapsam, kaydet))
    if tasima:
        assert tasima.sayac['sorgu'] >= 1 and tasima.sayac['pdf'] == len(depo) and tasima.sayac['hata'] == 0
    tamam = next(q for q in sorgular if q['identity'] == hedef['taxNumber'])
    assert tamam['outcome'] == 'ok' and tamam['access']['contractNumbers'] == [hedef['number']]
    assert sorted(r['recordId'] for r in tamam['records']) == sorted(k['oid'] for k in beklenen)
    assert all({d['kind'] for d in r['documents']} == {'declaration', 'tax_accrual'} for r in tamam['records'])
    belge_sayisi = sum(len(r['documents']) + sum(len(x['documents']) for x in r.get('sgk', [])) for r in tamam['records'])
    assert len(depo) == belge_sayisi
    # MUHSGK: SGK bildirimleri (işyeri × ay), iki PDF ve hizmet listesinden çalışan sayısı; kişi bilgisi sonuçta yok
    muhsgk = next(r for r in tamam['records'] if r['type'] == 'MUHSGK')
    kaynak = next(k for k in beklenen if k['tur'] == 'MUHSGK')
    assert [(x['workplace'], x['period']) for x in muhsgk['sgk']] == [(s['isyeri'], f"{s['donem'][3:]}-{s['donem'][:2]}") for s in kaynak['sgk']]
    for x, s in zip(muhsgk['sgk'], kaynak['sgk']):
        assert {d['kind'] for d in x['documents']} == {'sgk_accrual', 'sgk_service'}
        assert x['employeeCount'] == len(sahte_ebyn.calisanlar(kaynak['kimlik'], s['oid']))
    assert not any(t for t, _ in sahte_ebyn.calisanlar(kaynak['kimlik'], kaynak['sgk'][0]['oid']) if t in json.dumps(sorgular))
    if yok:
        assert next(q for q in sorgular if q['identity'] != hedef['taxNumber'])['outcome'] == 'no_access'
    jsonschema.validate(to_declarations(JOB, okunan, kapsam, sorgular, sahte=True), SEMA, format_checker=jsonschema.FormatChecker())


@pytest.mark.parametrize('erisim', ['robot', 'servis'])
def test_kayit_olmayan_ay_bos_sonuctur_hata_degil(sunucu, erisim):
    hedef = next(s for s in sahte.sozlesmeler(KULLANICI) if s['taxNumber'] and s['type'].startswith('Aracılık'))
    # 1-5 Ocak 2025: sahte veride yükleme günü 10-26 → kayıt yok
    _, [q], _ = asyncio.run(tara(sunucu, erisim, {'startDate': '2025-01-01', 'endDate': '2025-01-05', 'identities': [hedef['taxNumber']]}, None))
    assert (q['outcome'], q['records']) == ('empty', [])


def test_servis_yolunda_kaynak_hiz_siniri_isi_durdurur(sunucu):
    """GİB 429 bildirirse istek tekrarlanmaz, kalan kapsam sorgulanmaz ve sonucu yazılmaz; engel işçiye çıkar (işçi hızı düşürür)."""
    hedef = next(s for s in sahte.sozlesmeler(KULLANICI) if s['taxNumber'] and s['type'].startswith('Aracılık'))
    sahte.ZORLA['ebeyanname_sorgu'] = 429
    sahte.SAYAC.clear()
    try:
        _, sorgular, tasima = asyncio.run(tara(sunucu, 'servis', {'startDate': '2026-07-01', 'endDate': '2026-08-31',
                                                                 'identities': [hedef['taxNumber']]}, None))
    finally:
        sahte.ZORLA.clear()
    assert tasima.engel.kod == 'SOURCE_RATE_LIMIT'
    assert sahte.SAYAC['ebeyanname_sorgu'] == 1  # tek istek: yeniden deneme yok, Ağustos sorgulanmadı
    assert [(q['startDate'], q['outcome']) for q in sorgular] == [('2026-07-01', 'failed'), ('2026-08-01', 'failed')]
    assert 'hız sınırı' in sorgular[0]['message'] and sorgular[1]['message'] == 'Kurum erişimi durdu; sorgulanmadı.'
    assert all(q['records'] == [] for q in sorgular)
