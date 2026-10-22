"""19 Ekim canlı e-Tebligat kolonları. Belge içeriği/bağlantısı okunmaz.

Bu dönüşüm tek başına yetki, mükellef veya toplam kanıtı üretmez.
Seçili mükellef ve oturum kimliği ekran okuyucusunca ayrıca doğrulanmalıdır.
"""
from datetime import datetime
from hashlib import sha256
from institution_records import validate_module_batch

HEADERS = ('', 'Gönderen Kurum', 'Alt Birim', 'Belge Türü', 'Belge No',
           'Gönderme Tarihi', 'Tebliğ Tarihi', 'Mükellef Okuma Tarihi')


def parse_date(value, required=False):
    value=' '.join(value.split())
    if value in ('', '-', '—'):
        if required:
            raise ValueError('Gönderme tarihi eksik.')
        return None
    for fmt in ('%d.%m.%Y', '%d.%m.%Y %H:%M', '%d.%m.%Y %H:%M:%S'):
        try:
            return datetime.strptime(value,fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError('Tanınmayan e-Tebligat tarihi.')


def build_notice_batch(headers, rows, *, owner_id, identity, observed_identity,
                       year, expected_count, source_url, observed_at):
    if tuple(' '.join(h.split()) for h in headers)!=HEADERS:
        raise ValueError('Canlı e-Tebligat başlıkları eşleşmedi.')
    if observed_identity!=identity:
        raise ValueError('Ekrandaki mükellef kimliği hedef firmayla eşleşmiyor.')
    if type(expected_count) is not int or expected_count!=len(rows):
        raise ValueError('Kurum toplamı doğrulanamadı.')
    records=[]
    for row in rows:
        if len(row)!=len(HEADERS) or any(not isinstance(cell,str) for cell in row):
            raise ValueError('e-Tebligat satır biçimi geçersiz.')
        _,sender,department,document,reference,sent,delivered,read=row
        sender,department,document,reference=map(str.strip,(sender,department,document,reference))
        if not sender or not document or not reference:
            raise ValueError('e-Tebligat kimlik alanları eksik.')
        sent=parse_date(sent,required=True)
        if int(sent[:4])!=year:
            raise ValueError('Gönderim yılı hedef kapsam dışında.')
        delivered,read=parse_date(delivered),parse_date(read)
        stable='\x1f'.join((identity,sender,department,reference,sent))
        records.append(dict(identity=identity,recordId=sha256(stable.encode()).hexdigest(),
            document=document,reference=reference,date=sent,period=sent[:7],
            periodBasis='sent_date',sender=sender,department=department,
            deliveryDate=delivered,readDate=read,
            status=('Okuma tarihi var' if read else 'Tebliğ tarihi var' if delivered else 'Gönderim kaydı')))
    batch=dict(schema='eworks.gib.module.v1',ownerId=owner_id,module='notices',
        sourceURL=source_url,observedAccountIdentity=observed_identity,year=year,
        expectedCount=expected_count,complete=True,observedAt=observed_at,records=records)
    validate_module_batch(batch,owner_id=owner_id,identity=identity,year=year)
    return batch
