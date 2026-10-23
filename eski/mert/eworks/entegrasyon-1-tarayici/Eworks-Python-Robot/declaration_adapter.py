"""Canlıda gözlenen eski e-Beyanname liste alanlarını doğrular.

Bu modül giriş yapmaz, belge açmaz, tam liste veya müşavir yetkisi iddia etmez.
"""
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from source_record_id import canonical_source_id


def normalize_declaration_rows(rows, *, identity, year, upload_month, expected_count, upload_year_only=False,upload_range=None,period_range=None,identity_aliases=None):
    if not re.fullmatch(r'\d{10,11}', identity):
        raise ValueError('Hedef kimlik geçersiz.')
    if type(year) is not int or not 2004 <= year <= 2100:
        raise ValueError('Hedef yıl geçersiz.')
    if type(upload_month) is not int or not 1 <= upload_month <= 12:
        raise ValueError('Yükleme ayı geçersiz.')
    if type(expected_count) is not int or expected_count < 0 or not isinstance(rows,list) or len(rows) != expected_count:
        raise ValueError('Kaynak liste toplamı doğrulanamadı.')
    result=[]
    seen=set()
    for row in rows:
        aliases=set(identity_aliases or [identity])
        if identity not in aliases or any(not isinstance(v,str) or not re.fullmatch(r'\d{10,11}',v) for v in aliases):raise ValueError('Sözleşme kimlik eşlemesi geçersiz.')
        if not isinstance(row,dict) or row.get('identity') not in aliases:
            raise ValueError('Başka mükellefe ait satır.')
        raw_source_id=row.get('sourceRowId','')
        source_id=canonical_source_id(raw_source_id)
        if source_id in seen:
            raise ValueError('Kaynak satır kimliği eksik veya mükerrer.')
        seen.add(source_id)
        document=row.get('document','')
        if not re.fullmatch(r'[A-Z0-9_-]{1,30}',document):
            raise ValueError('Beyanname türü doğrulanamadı.')
        period=re.fullmatch(r'(0[1-9]|1[0-2])/(\d{4})-(0[1-9]|1[0-2])/(\d{4})',row.get('period',''))
        if not period or (int(period[2]),int(period[1])) > (int(period[4]),int(period[3])) or (not upload_year_only and (int(period[2]) != year or int(period[4]) != year)):
            raise ValueError('Vergilendirme dönemi hedef dışında.')
        uploaded=datetime.strptime(row.get('uploadedAt',''),'%d.%m.%Y - %H:%M:%S').replace(tzinfo=ZoneInfo('Europe/Istanbul'))
        if uploaded.year != year or uploaded.month != upload_month:
            raise ValueError('Yükleme tarihi sorgu aralığı dışında.')
        if upload_range and not upload_range[0]<=uploaded.date().isoformat()<=upload_range[1]:raise ValueError('Yükleme tarihi seçilen gün aralığı dışında.')
        if period_range and not (f'{period[2]}-{period[1]}'<=period_range[1] and f'{period[4]}-{period[3]}'>=period_range[0]):raise ValueError('Beyanname seçilen vergilendirme dönemi dışında.')
        source_status=row.get('taxStatus','')
        # Durum yetki kanıtı değildir. GİB yeni bir etiket sunduğunda onu
        # onaylanmışa çevirmeden aynen koru; tüm kimlik/tarih/kaynak kontrolleri sürer.
        if not isinstance(source_status,str) or len(source_status)>1024 or any(ord(c)<32 and c not in '\r\n\t' for c in source_status):
            raise ValueError('Vergi tahakkuk durumu okunamadı.')
        status=' '.join(source_status.split())
        reference=row.get('sourceFilename','')
        reference_type='source_filename'
        if not reference and row.get('sourceReferenceType')=='source_record_id' and len(raw_source_id)>=10:
            reference=raw_source_id;reference_type='source_record_id'
        elif not re.fullmatch(r'[A-Za-z0-9_-]+\.xml',reference) or not aliases.intersection(reference.split('_')):
            raise ValueError('Kaynak dosya referansı doğrulanamadı.')
        result.append(dict(identity=identity,recordId=source_id,document=document,
            reference=reference,period=f'{period[2]}-{period[1]}',date=uploaded.date().isoformat(),
            status=status or 'Durum belirtilmedi',metadata=dict(originalPeriod=row['period'],periodEnd=f'{period[4]}-{period[3]}',
                uploadedAt=uploaded.isoformat(),sgkStatus=row.get('sgkStatus',''),
                sourceRowId=raw_source_id,referenceType=reference_type,
                sourceTaxStatus=source_status,taxStatusRecognized=status in ('İptal','Onaylandı','Onay bekliyor','Hatalı'))))
        if row['identity']!=identity:result[-1]['metadata'].update(observedIdentity=row['identity'],identityMapping='same_session_contract')
    return result
