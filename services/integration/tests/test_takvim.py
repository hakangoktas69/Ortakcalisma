"""Takvim kaynakları (workspace takvimi, 4c): GİB vergi takvimi (listAll, 2026-10-27'de gözlendi) ve Nager.Date resmî tatilleri.
Ayrıştırıcılar fail-closed; akış süreç içi sahte sunucuya karşı (canlı GİB değildir, D33)."""
import asyncio
import json
import os
from pathlib import Path

import jsonschema
import pytest

from eworks_integration.institutions.acik_kaynak.nager import BayramHatasi, bayramlari_ayristir, resmi_tatilleri_oku
from eworks_integration.institutions.gib.vergi_takvimi import TakvimHatasi, istek_govdesi, liste_adresi, to_snapshot, vergi_takvimi_oku, yil_kayitlari
from tests.sahte_kurumlar import gib as sahte

SOZLESME_KOKU = Path(os.environ['EWORKS_SOZLESMELER']) if 'EWORKS_SOZLESMELER' in os.environ else Path(__file__).resolve().parents[3] / 'contracts'


def kayit(i, tarih, subject='Beyan ve Ödeme'):
    return {'id': i, 'title': 'Katma Değer Vergisinin Beyan ve Ödemesi', 'description': 'Açıklama', 'startdate': f'{tarih[:7]}-01T00:00:00', 'stopdate': f'{tarih}T00:00:00',
            'priority': 1, 'taxType': 'KDV', 'periodDescription': 'Eylül 2026 Dönemi', 'subject': subject, 'startDateBeforeStopDate': True}


def yanit(kayitlar, status=200):
    return {'status': status, 'statusMessage': 'OK', 'messages': [], 'resultContainer': kayitlar}


def test_istek_yil_araligi_gozlenen_bicimde():
    g = istek_govdesi(2027)
    assert g['globalOperator'] == 'AND'
    assert [(f['column'], f['operation'], f['value']) for f in g['searchRequestListDTOS']] == [
        ('stopdate', 'GREATER_THAN', '2026-12-31T23:59:59'), ('stopdate', 'LESS_THAN', '2028-01-01T00:00:00')]
    assert liste_adresi(None).startswith('https://gib.gov.tr/api/gibportal/vergiTakvimi/specification/listAll?')
    assert liste_adresi('http://sahte:8090') .startswith('http://sahte:8090/gib/api/gibportal/vergiTakvimi/specification/listAll?')


@pytest.mark.feature('genel_bakis.takvim.sync')
def test_gib_kayitlari_normallestirilir_fazla_alanlar_atilir():
    k = yil_kayitlari(yanit([kayit(2, '2026-11-26'), kayit(1, '2026-10-28', 'Berat')]), 2026)
    assert [x['id'] for x in k] == [1, 2]
    assert set(k[0]) == {'id', 'title', 'description', 'stopdate', 'periodDescription', 'subject'}
    s = to_snapshot(k, 2026, '2026-10-27')
    assert s['schema'] == 'eworks.gib.tax-calendar.v1' and s['count'] == 2 and s['sourceUrl'] == 'https://gib.gov.tr/vergi-takvimi'


def test_gib_fail_closed():
    with pytest.raises(TakvimHatasi, match='kurum_yaniti'):
        yil_kayitlari(yanit([kayit(1, '2026-10-28')], status=500), 2026)
    with pytest.raises(TakvimHatasi, match='sema'):
        yil_kayitlari({'status': 200, 'resultContainer': 'x'}, 2026)
    with pytest.raises(TakvimHatasi, match='tekrar'):
        yil_kayitlari(yanit([kayit(1, '2026-10-28'), kayit(1, '2026-11-26')]), 2026)
    with pytest.raises(TakvimHatasi, match='yil_disi'):
        yil_kayitlari(yanit([kayit(1, '2027-01-26')]), 2026)
    with pytest.raises(TakvimHatasi, match='alan'):
        yil_kayitlari(yanit([{**kayit(1, '2026-10-28'), 'title': ''}]), 2026)
    with pytest.raises(TakvimHatasi, match='bos'):
        yil_kayitlari(yanit([]), 2026)


def nager(yil, belirsiz=True):
    ek = ' (Tentative Date)' if belirsiz else ''
    return [{'date': f'{yil}-01-01', 'localName': 'Yılbaşı', 'name': "New Year's Day", 'types': ['Public']},
            *[{'date': f'{yil}-03-{10 + i}', 'localName': f'Ramazan Bayramı {i + 1}. Gün{ek}', 'name': 'Eid al-Fitr', 'types': ['Public']} for i in range(3)],
            *[{'date': f'{yil}-05-{16 + i}', 'localName': f'Kurban Bayramı {i + 1}. Gün{ek}', 'name': 'Eid al-Adha', 'types': ['Public']} for i in range(4)]]


@pytest.mark.feature('genel_bakis.takvim.sync')
def test_nager_bayramlar_ve_kesinlik():
    assert bayramlari_ayristir(nager(2027), 2027) == {'ramazan': '2027-03-10', 'kurban': '2027-05-16', 'certain': False}
    assert bayramlari_ayristir(nager(2027, belirsiz=False), 2027)['certain'] is True


def test_nager_fail_closed():
    eksik = [x for x in nager(2027) if 'Kurban Bayramı 4' not in x['localName']]
    with pytest.raises(BayramHatasi):
        bayramlari_ayristir(eksik, 2027)
    kopuk = [{**x, 'date': '2027-03-20'} if x['localName'].startswith('Ramazan Bayramı 2') else x for x in nager(2027)]
    with pytest.raises(BayramHatasi):
        bayramlari_ayristir(kopuk, 2027)
    with pytest.raises(BayramHatasi):
        bayramlari_ayristir(nager(2026), 2027)
    with pytest.raises(BayramHatasi):
        bayramlari_ayristir({'x': 1}, 2027)


@pytest.fixture(scope='module')
def sunucu():
    s = sahte.baslat(0)
    yield f'http://127.0.0.1:{s.server_address[1]}'
    s.shutdown()


@pytest.mark.feature('genel_bakis.takvim.sync')
def test_sahte_sunucudan_yil_okunur_ve_sema_uyar(sunucu):
    kayitlar = asyncio.run(vergi_takvimi_oku(2027, None, sunucu))
    assert kayitlar and all(k['stopdate'].startswith('2027-') for k in kayitlar)
    assert len({k['id'] for k in kayitlar}) == len(kayitlar)
    bayram = asyncio.run(resmi_tatilleri_oku(2027, None, sunucu))
    assert bayram['certain'] is False and bayram['ramazan'].startswith('2027-')
    sonuc = {'schema': 'eworks.calendar.sources.v1', 'jobId': '11111111-2222-4333-8444-555555555555', 'year': 2027, 'observedAt': '2026-10-27T10:00:00Z',
             'sourceType': 'sahte_gib', 'gib': to_snapshot(kayitlar, 2027, '2026-10-27'), 'gibError': None,
             'religious': {**bayram, 'sourceUrl': 'https://date.nager.at', 'checkedAt': '2026-10-27'}, 'religiousError': None}
    sema = json.loads((SOZLESME_KOKU / 'integration' / 'eworks.calendar.sources.v1.schema.json').read_text(encoding='utf-8'))
    jsonschema.validate(sonuc, sema)
