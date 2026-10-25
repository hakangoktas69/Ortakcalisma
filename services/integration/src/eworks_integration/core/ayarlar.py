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
    return Ayarlar(
        rabbitmq_url=gerekli('RABBITMQ_URL'), redis_url=gerekli('REDIS_URL'), s3_endpoint=gerekli('S3_ENDPOINT'),
        s3_bucket=e.get('S3_BUCKET', 'eworks-belgeler'), s3_erisim=gerekli('S3_ACCESS_KEY'), s3_gizli=gerekli('S3_SECRET_KEY'),
        s3_bolge=e.get('S3_REGION', 'tr-1'), shardlar=shard_cozumle(gerekli('SHARD_DATABASE_URLS')), ortam=ortam, sahte_gib=sahte,
        gib_istek_dk=hiz, is_zaman_asimi_sn=int(e.get('IS_ZAMAN_ASIMI_SN', '7200')),
    )
