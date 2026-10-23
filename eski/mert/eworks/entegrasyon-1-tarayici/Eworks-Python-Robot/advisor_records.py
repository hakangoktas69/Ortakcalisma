"""Müşavirden mükellefe aktarım: sözleşme VE canlı modül yetkisi gerekir.

authorized_identities yalnızca modülün canlı mükellef seçimi/listesinden gelmeli;
istek gövdesinden veya sözleşmelerden türetilmemelidir.
"""
from copy import deepcopy
import re
import unicodedata
from uuid import UUID
from institution_records import validate_module_batch, merge_module_records


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD',value.casefold())
                   if not unicodedata.combining(c)).replace('ı','i').strip()


def advisor_batch_for_validation(batch, *, owner_id, advisor_identity, identity,
                                 year, contracts, authorized_identities,authorization_module):
    if (not isinstance(advisor_identity,str)
            or not re.fullmatch(r'\d{10,11}',advisor_identity)):
        raise ValueError('Müşavir oturum kimliği doğrulanamadı.')
    if (not isinstance(batch,dict) or batch.get('accessMode')!='advisor'
            or batch.get('ownerId')!=str(UUID(owner_id))
            or batch.get('observedAccountIdentity')!=advisor_identity
            or batch.get('observedTaxpayerIdentity')!=identity):
        raise ValueError('Müşavir oturumu ve seçili mükellef eşleşmiyor.')
    # Sözleşme tek başına her kurum modülünde erişim yetkisi sağlamaz.
    if batch.get('module')!=authorization_module or identity not in authorized_identities:
        raise ValueError('Bu modülde mükellef erişimi canlı doğrulanmamış.')
    valid_types={'aracilik ve sorumluluk sozlesmesi',
                 'elektronik beyanname aracilik ve sorumluluk sozlesmesi'}
    numbers={row.get('number') for row in contracts
             if isinstance(row,dict)
             and identity in (row.get('taxNumber'),row.get('identityNumber'))
             and isinstance(row.get('type'),str)
             and normalized(row['type']) in valid_types
             and isinstance(row.get('number'),str) and row['number'].strip()}
    if not numbers or batch.get('contractNumber') not in numbers:
        raise ValueError('Geçerli aracılık ve sorumluluk sözleşmesi eşleşmiyor.')
    normalized_batch=deepcopy(batch)
    # Ortak satır/kaynak/toplam/dönem kontrollerini aynen kullan.
    # Özgün müşavir kimliğini değiştirme veya firma girişi varmış gibi kaydetme.
    normalized_batch['observedAccountIdentity']=identity
    validate_module_batch(normalized_batch,owner_id=owner_id,identity=identity,year=year)
    return normalized_batch


def merge_advisor_records(existing,batch,*,owner_id,advisor_identity,identity,
                          year,contracts,authorized_identities,authorization_module):
    checked=advisor_batch_for_validation(batch,owner_id=owner_id,
        advisor_identity=advisor_identity,identity=identity,year=year,
        contracts=contracts,authorized_identities=authorized_identities,
        authorization_module=authorization_module)
    # Denetim izi: müşavir kimliği ile kaynak oturum açıkça saklanır.
    for row in checked['records']:
        row.update(accessMode='advisor',advisorIdentity=advisor_identity,
                   contractNumber=batch['contractNumber'])
    return merge_module_records(existing,checked,owner_id=owner_id,identity=identity,year=year)
