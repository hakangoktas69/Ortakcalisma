"""GİB'in URL-kodlu opak kimliği ile güvenli yerel dosya anahtarını ayırır."""
import hashlib
import re
import unicodedata
from urllib.parse import unquote

def decoded_source_id(value):
    if not isinstance(value,str) or not 1<=len(value)<=300:raise ValueError('Kaynak kayıt kimliği geçersiz.')
    if '%' in value:
        if re.search(r'%(?![0-9A-Fa-f]{2})',value):raise ValueError('Kaynak kimlik kodlaması geçersiz.')
        value=unquote(value,encoding='utf-8',errors='strict')
    # Opak kaynak kimliği dosya yolu değildir. Noktalama/simgeler hash anahtarına
    # çevrilir; DOM/onclick için tırnak, kontrol ve boşluk karakterleri reddedilir.
    if (not 1<=len(value)<=100 or '..' in value or
            any(c in "'\"\\`" or c.isspace() or unicodedata.category(c)[0] in 'CZ' for c in value)):
        raise ValueError('Kaynak kayıt kimliği karakterleri doğrulanamadı.')
    return value

def canonical_source_id(value):
    decoded=decoded_source_id(value)
    if re.fullmatch(r'[A-Za-z0-9_-]{1,100}',value):return value
    return 'encoded-'+hashlib.sha256(decoded.encode('utf-8')).hexdigest()

def source_id(row):return row.get('metadata',{}).get('sourceRowId',row['recordId'])

def action_ids(value):return tuple(dict.fromkeys((value,decoded_source_id(value))))
