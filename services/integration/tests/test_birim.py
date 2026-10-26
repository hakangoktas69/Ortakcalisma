"""Birim testleri: liste kuralları, yayımlanmış dil, hız sınırı, ayarlar (tarayıcısız)."""
import json
import os
from pathlib import Path

import jsonschema
import pytest

from eworks_integration.core.ayarlar import yukle
from eworks_integration.core.hiz import gcra
from eworks_integration.institutions.gib.sozlesmeler import ListeHatasi, footer_counts, to_contract, validate_contracts
from tests.sahte_kurumlar.gib import sozlesmeler

SOZLESME_KOKU = Path(os.environ['EWORKS_SOZLESMELER']) if 'EWORKS_SOZLESMELER' in os.environ else Path(__file__).resolve().parents[3] / 'contracts'
SEMA = json.loads((SOZLESME_KOKU / 'integration' / 'eworks.gib.contracts.v1.schema.json').read_text(encoding='utf-8'))
JOB = '11111111-2222-4333-8444-555555555555'


def test_alt_bilgi_toplami():
    assert footer_counts('1 - 20 listeleniyor. Toplam : 45 Tümünü Göster') == (1, 20, 45)
    assert footer_counts('başlık yok') is None
    with pytest.raises(ListeHatasi):
        footer_counts('1 - 20 listeleniyor. Toplam : 45 ve 1 - 20 listeleniyor. Toplam : 46')
    with pytest.raises(ListeHatasi):
        footer_counts('5 - 2 listeleniyor. Toplam : 3')


def test_liste_dogrulama_fail_closed():
    kayitlar = sozlesmeler('12345678')[:3]
    validate_contracts(kayitlar, 3)
    with pytest.raises(ListeHatasi):
        validate_contracts(kayitlar, 4)
    with pytest.raises(ListeHatasi):
        validate_contracts(kayitlar + [dict(kayitlar[0])], 4)
    with pytest.raises(ListeHatasi):
        validate_contracts([{**kayitlar[0], 'taxNumber': '12AB', 'identityNumber': ''}], 1)


def test_yayimlanmis_dil_semaya_uyar_ve_kaynak_turu_acik():
    sonuc = to_contract(JOB, sozlesmeler('12345678'), sahte=True)
    jsonschema.validate(sonuc, SEMA, format_checker=jsonschema.FormatChecker())
    assert sonuc['sourceType'] == 'sahte_gib' and sonuc['count'] == 45
    assert to_contract(JOB, sozlesmeler('1')[:1], sahte=False)['sourceType'] == 'gib_live'


def test_gcra_dakika_butcesi():
    aralik, tolerans = 1000.0, 3000.0  # 60/dk, 3 istek tolerans
    tat, izinli = None, 0
    for _ in range(10):
        bekle, yeni = gcra(tat, 0.0, aralik, tolerans)
        if bekle == 0:
            izinli, tat = izinli + 1, yeni
    assert izinli == 4  # anlık patlama toleransla sınırlı
    bekle, _ = gcra(tat, 0.0, aralik, tolerans)
    assert bekle == pytest.approx(1000.0)


def test_uretimde_sahte_gib_yasak():
    temel = {'RABBITMQ_URL': 'amqp://x', 'REDIS_URL': 'redis://x', 'S3_ENDPOINT': 'http://s3', 'S3_ACCESS_KEY': 'a', 'S3_SECRET_KEY': 'b',
             'SHARD_DATABASE_URLS': 'shard-01=postgres://x'}
    assert yukle({**temel, 'EWORKS_ORTAM': 'demo', 'GIB_SAHTE_SUNUCU': 'http://fake'}).sahte_gib == 'http://fake'
    with pytest.raises(ValueError, match='Üretimde'):
        yukle({**temel, 'GIB_SAHTE_SUNUCU': 'http://fake'})


def test_kurum_erisim_yolu_parametresi():
    """D38: robot → yalnız tarayıcı; servis (vars.) → aynı GİB oturumunda HTTP taşıma. Bilinmeyen değerle açılmaz."""
    temel = {'RABBITMQ_URL': 'amqp://x', 'REDIS_URL': 'redis://x', 'S3_ENDPOINT': 'http://s3', 'S3_ACCESS_KEY': 'a', 'S3_SECRET_KEY': 'b',
             'SHARD_DATABASE_URLS': 'shard-01=postgres://x'}
    a = yukle(temel)
    assert (a.gib_erisim, a.sgk_erisim) == ('servis', 'servis')
    assert yukle({**temel, 'GIB_ERISIM_YOLU': 'robot'}).gib_erisim == 'robot'
    assert yukle({**temel, 'GIB_ERISIM_YOLU': ' Robot '}).gib_erisim == 'robot'
    for ad in ('GIB_ERISIM_YOLU', 'SGK_ERISIM_YOLU', 'ERISIM_GIB_EBEYANNAME'):
        with pytest.raises(ValueError, match=f'{ad} robot ya da servis'):
            yukle({**temel, ad: 'webservis'})


def test_oturum_sonrasi_hizmet_bazinda_erisim_yolu():
    """D38: giriş her zaman tarayıcıda; oturum sonrası her hizmet robot | servis. Kurum varsayılanı servis ise HTTP politikası
    olmayan hizmet robotla çalışır; hizmete açıkça servis istenip politika yoksa açılışta reddedilir (uç uydurulmaz)."""
    temel = {'RABBITMQ_URL': 'amqp://x', 'REDIS_URL': 'redis://x', 'S3_ENDPOINT': 'http://s3', 'S3_ACCESS_KEY': 'a', 'S3_SECRET_KEY': 'b',
             'SHARD_DATABASE_URLS': 'shard-01=postgres://x'}
    assert yukle(temel).erisim == {'gib.ivd': 'robot', 'gib.ebeyanname': 'servis'}
    assert yukle({**temel, 'GIB_ERISIM_YOLU': 'robot'}).erisim == {'gib.ivd': 'robot', 'gib.ebeyanname': 'robot'}
    assert yukle({**temel, 'GIB_ERISIM_YOLU': 'robot', 'ERISIM_GIB_EBEYANNAME': 'servis'}).erisim['gib.ebeyanname'] == 'servis'
    assert yukle({**temel, 'ERISIM_GIB_EBEYANNAME': 'robot'}).erisim['gib.ebeyanname'] == 'robot'
    with pytest.raises(ValueError, match='ERISIM_GIB_IVD=servis desteklenmiyor'):
        yukle({**temel, 'ERISIM_GIB_IVD': 'servis'})


def test_kod_hatasi_sifre_hatasi_sanilmaz():
    from eworks_integration.institutions.gib.giris import KOD_HATASI, SIFRE_HATASI
    ekran = 'Kullanıcı Kodu / T.C. Kimlik No Şifre Güvenlik Kodu Giriş Yap Güvenlik kodu hatalı. Lütfen tekrar deneyiniz.'
    assert KOD_HATASI.search(ekran)
    assert not SIFRE_HATASI.search('Şifre Güvenlik Kodu Giriş Yap Güvenlik kodu hatalı.')
    assert SIFRE_HATASI.search('Kullanıcı kodu veya şifre hatalı.')
    assert not KOD_HATASI.search('Kullanıcı kodu veya şifre hatalı.')
