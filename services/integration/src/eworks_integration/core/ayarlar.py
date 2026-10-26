"""Ortam ayarları (açılışta doğrulanır). Üretimde sahte kurum yönlendirmesi yasaktır (D33: canlı ile sahte karışmaz)."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Ayarlar:
    rabbitmq_url: str
    redis_url: str
    s3_endpoint: str
    s3_bucket: str
    s3_erisim: str
    s3_gizli: str
    s3_bolge: str
    shardlar: dict[str, str]
    ortam: str
    sahte_gib: str | None
    gib_istek_dk: int
    is_zaman_asimi_sn: int
    gib_erisim: str = 'servis'
    sgk_erisim: str = 'servis'
    erisim: dict[str, str] | None = None


# Kurum erişim yolu (D38). Oturum açılışı (CAPTCHA) her zaman tarayıcıdadır; oturum sonrası her hizmet ayrı seçilir:
# robot = tarayıcı tıklaması (Eworks 1), servis = aynı kurum oturumunun doğrulanmış HTTP taşıması (Eworks 2). "servis" resmi kurum
# web servisi değildir; o gelince ayrı değer olur.
ERISIM_YOLLARI = ('robot', 'servis')

# Oturum sonrası hizmetler: (kurum, servis yolu için gözlenmiş HTTP politikası var mı). Politika yoksa servis uydurulmaz.
HIZMETLER = {
    'gib.ivd': ('GIB', False),         # İnternet Vergi Dairesi: e-Beyanname sözleşme listesi
    'gib.ebeyanname': ('GIB', True),   # e-Beyanname: beyanname listesi + PDF'ler, MUHSGK SGK bildirimleri (institutions/gib/ebeyanname_servis.py)
}


def erisim_yolu(e: dict[str, str], ad: str, varsayilan: str = 'servis') -> str:
    deger = (e.get(ad) or varsayilan).strip().lower()
    if deger not in ERISIM_YOLLARI:
        raise ValueError(f'{ad} robot ya da servis olmalı')
    return deger


def hizmet_erisimleri(e: dict[str, str], kurum_varsayilani: dict[str, str]) -> dict[str, str]:
    """Hizmet → yol. ERISIM_<KURUM>_<HİZMET> kurum varsayılanını ezer. Varsayılan servis ama politika yoksa robot; açıkça servis
    istenip politika yoksa açılış reddedilir."""
    sonuc = {}
    for hizmet, (kurum, destekli) in HIZMETLER.items():
        ad = 'ERISIM_' + hizmet.upper().replace('.', '_')
        if e.get(ad):
            yol = erisim_yolu(e, ad)
            if yol == 'servis' and not destekli:
                raise ValueError(f'{ad}=servis desteklenmiyor: bu hizmet için gözlenmiş HTTP politikası yok (robot kullanın)')
        else:
            yol = kurum_varsayilani[kurum] if destekli else 'robot'
        sonuc[hizmet] = yol
    return sonuc


def shard_cozumle(ham: str) -> dict[str, str]:
    sonuc = {}
    for parca in filter(None, (p.strip() for p in ham.split(','))):
        ad, _, url = parca.partition('=')
        if not ad or not url:
            raise ValueError('SHARD_DATABASE_URLS biçimi: shard-01=postgres://…')
        sonuc[ad.strip()] = url.strip()
    if not sonuc:
        raise ValueError('En az bir shard tanımlanmalı')
    return sonuc


def yukle(env: dict[str, str] | None = None) -> Ayarlar:
    e = dict(os.environ if env is None else env)

    def gerekli(k: str) -> str:
        v = e.get(k)
        if not v:
            raise ValueError(f'{k} tanımlı değil')
        return v

    ortam = e.get('EWORKS_ORTAM', 'uretim')
    if ortam not in ('gelistirme', 'demo', 'uretim'):
        raise ValueError('EWORKS_ORTAM geçersiz')
    sahte = e.get('GIB_SAHTE_SUNUCU') or None
    if sahte and ortam == 'uretim':
        raise ValueError('Üretimde sahte GİB yönlendirmesi kullanılamaz')
    hiz = int(e.get('GIB_ISTEK_DK', '60'))
    if not 1 <= hiz <= 6000:
        raise ValueError('GIB_ISTEK_DK 1–6000 arasında olmalı')
    gib, sgk = erisim_yolu(e, 'GIB_ERISIM_YOLU'), erisim_yolu(e, 'SGK_ERISIM_YOLU')
    return Ayarlar(
        rabbitmq_url=gerekli('RABBITMQ_URL'), redis_url=gerekli('REDIS_URL'), s3_endpoint=gerekli('S3_ENDPOINT'),
        s3_bucket=e.get('S3_BUCKET', 'eworks-belgeler'), s3_erisim=gerekli('S3_ACCESS_KEY'), s3_gizli=gerekli('S3_SECRET_KEY'),
        s3_bolge=e.get('S3_REGION', 'tr-1'), shardlar=shard_cozumle(gerekli('SHARD_DATABASE_URLS')), ortam=ortam, sahte_gib=sahte,
        gib_istek_dk=hiz, is_zaman_asimi_sn=int(e.get('IS_ZAMAN_ASIMI_SN', '7200')),
        gib_erisim=gib, sgk_erisim=sgk, erisim=hizmet_erisimleri(e, {'GIB': gib, 'SGK': sgk}),
    )
