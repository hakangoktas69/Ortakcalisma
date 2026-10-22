"""Kurum liste adaptörlerinin ortak sözleşmesi; kendi başına canlı veri çekmez.

Her modül ayrı doğrulanır. Başarısız/eksik okumalar mevcut kaydı silemez.
Alan eşlemeleri ancak ilgili canlı ekran gözlendikten sonra adaptöre eklenir.
"""
from datetime import date, datetime
from urllib.parse import urlsplit
from uuid import UUID
import re

MODULE_HOSTS = {
    'notices': {'dijital.gib.gov.tr', 'intvrg.gib.gov.tr'},
    'declarations': {'ebeyan.gib.gov.tr', 'ebeyanname.gib.gov.tr', 'intvrg.gib.gov.tr'},
    'ledgers': {'edefter.gib.gov.tr', 'uyg.edefter.gov.tr'},
}


def validate_module_batch(batch, *, owner_id, identity, year):
    """Tek hesap/tek yıl pilot kapsamı. Doğrulanmamış kaynak sonucu kabul etmez."""
    if not re.fullmatch(r'\d{10,11}', identity):
        raise ValueError('Hedef VKN/TCKN geçersiz.')
    if type(year) is not int or not 2000 <= year <= 2100:
        raise ValueError('Hedef yıl geçersiz.')
    if not isinstance(batch, dict) or batch.get('schema') != 'eworks.gib.module.v1':
        raise ValueError('Modül aktarım biçimi geçersiz.')
    if str(UUID(owner_id)) != batch.get('ownerId'):
        raise ValueError('Portal oturumu eşleşmiyor.')
    module = batch.get('module')
    if module not in MODULE_HOSTS:
        raise ValueError('Bilinmeyen modül.')
    source = urlsplit(batch.get('sourceURL', ''))
    if (source.scheme != 'https' or source.hostname not in MODULE_HOSTS[module]
            or source.username or source.password or source.port not in (None, 443)
            or source.query or source.fragment):
        raise ValueError('Doğrulanmamış kaynak adresi.')
    if (batch.get('observedAccountIdentity') != identity or batch.get('year') != year
            or batch.get('complete') is not True):
        raise ValueError('Hesap/dönem/kapsam doğrulanamadı; önceki kayıtlar korunmalı.')
    observed = datetime.fromisoformat(batch.get('observedAt', ''))
    if observed.tzinfo is None:
        raise ValueError('Kaynak okuma zaman dilimi eksik.')
    rows = batch.get('records')
    if (not isinstance(rows, list) or len(rows) > 100000
            or type(batch.get('expectedCount')) is not int
            or batch['expectedCount'] != len(rows)):
        raise ValueError('Kurum toplamı ile okunan liste eşleşmiyor.')
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or row.get('identity') != identity:
            raise ValueError('Başka firmaya ait kayıt; aktarım uygulanmaz.')
        for key in ('recordId', 'document', 'reference', 'period', 'status'):
            if not isinstance(row.get(key), str) or not row[key].strip() or len(row[key]) > 1024:
                raise ValueError('Eksik veya geçersiz kurum kayıt alanı: '+key)
        period = row['period']
        if not re.fullmatch(str(year)+r'-(0[1-9]|1[0-2])', period):
            raise ValueError('Kayıt hedef dönem dışında.')
        date.fromisoformat(row.get('date', ''))
        if row['recordId'] in seen:
            raise ValueError('Mükerrer kurum kaydı.')
        seen.add(row['recordId'])
    return batch


def merge_module_records(existing, batch, *, owner_id, identity, year):
    """Doğrulanmış kayıtları ekler/günceller; boş sonuçta eski veriyi silmez."""
    validate_module_batch(batch, owner_id=owner_id, identity=identity, year=year)
    def key(row):
        return row['module'], row['identity'], row['period'], row['recordId']
    result = {key(row): dict(row) for row in existing}
    for row in batch['records']:
        normalized = dict(row, module=batch['module'], sourceURL=batch['sourceURL'],
                          observedAt=batch['observedAt'], sourceType='gib_live')
        result[key(normalized)] = normalized
    return list(result.values())
