"""Doğrulanmış e-Tebligat metadata listesini mevcut Eworks yedeğine ekler.
Ağ/kimlik bilgisi/tebligat belgesi kullanmaz. Diğer verileri silmez.
"""
import copy,re
from datetime import date,datetime,timezone
from uuid import UUID
from notice_service import LIST_PATH

def prepare_notice_import(snapshot,backup,source_job):
 if (snapshot.get('schema')!='eworks.notice-list.v1' or snapshot.get('complete') is not True
     or snapshot.get('accountVerified') is not True or snapshot.get('documentsOpened') is not False
     or snapshot.get('sourceURL')!='https://dijital.gib.gov.tr'+LIST_PATH
     or snapshot.get('scope')!='observed_list_filter' or not re.fullmatch(r'[a-f0-9]{32}',source_job)):
  raise ValueError('Tebligat kaynak doğrulaması eksik.')
 owner=str(UUID(snapshot['ownerId']));identity=snapshot['identity'];records=snapshot['records']
 if type(snapshot.get('count')) is not int or snapshot['count']!=len(records):raise ValueError('Tebligat toplamı geçersiz.')
 d=copy.deepcopy(backup['data']);firms=[f for f in d['firms'] if f.get('id')==snapshot['firmId']]
 if len(firms)!=1:raise ValueError('Tebligat firması tekil eşleşmedi.')
 firm=firms[0];identities={firm.get('taxNumber'),firm.get('identityNumber')}-{None,''}
 if identity not in identities or snapshot['observedAccountIdentity'] not in identities:raise ValueError('Firma VKN/TCKN kapsamı değişti.')
 owners={x.get('ownerId') for x in d.get('notes',[]) if x.get('ownerId')}
 if owners!={owner}:raise ValueError('Eworks yedeğinin hesap sahibi doğrulanamadı.')
 notes=d.get('notes',[]);by_id={x['id']:x for x in notes}
 if len(by_id)!=len(notes):raise ValueError('Mevcut Eworks kaydı tekil değil.')
 seen=set();added=updated=0;now=datetime.now(timezone.utc).isoformat()
 for row in records:
  key=row.get('recordId')
  if not isinstance(key,str) or not re.fullmatch(r'[a-f0-9]{64}',key) or key in seen or row.get('identity')!=identity:raise ValueError('Tebligat kayıt kimliği geçersiz.')
  seen.add(key)
  date.fromisoformat(row['date'])
  if row.get('readDate'):date.fromisoformat(row['readDate'])
  if row.get('deliveryDate'):date.fromisoformat(row['deliveryDate'])
  if row.get('period')!=row['date'][:7]:raise ValueError('Tebligat dönemi uyuşmuyor.')
  for field in ('document','reference','sender'):
   if not isinstance(row.get(field),str) or not row[field].strip() or len(row[field])>2000:raise ValueError('Tebligat tanım alanı geçersiz.')
  rid='gib-notice:'+identity+':'+key;old=by_id.get(rid)
  if old and (old.get('ownerId')!=owner or old.get('firmId')!=firm['id'] or old.get('sourceType')!='gib_notice_live'):raise ValueError('Mevcut kayıt kapsamı uyuşmuyor.')
  meta=dict(sender=row['sender'],department=row.get('department',''),deliveryDate=row.get('deliveryDate'),readDate=row.get('readDate'),listScope='observed_list_filter',documentsOpened=False)
  merged={**(old or {}),**dict(id=rid,page='notices',module='notices',ownerId=owner,firmId=firm['id'],firm=firm['name'],identity=identity,recordId=key,document=row['document'],reference=row['reference'],date=row['date'],period=row['period'],status='Okundu' if row.get('readDate') else 'Okuma tarihi yok',sourceType='gib_notice_live',sourceJobId=source_job,sourceURL=snapshot['sourceURL'],authorizationVerified=True,metadata=meta,note='Gönderen kurum: '+row['sender']+(' · Alt birim: '+row['department'] if row.get('department') else '')+' · GİB liste kaydı; belge açılmadı.',importedAt=now)}
  if old:notes[notes.index(old)]=merged;updated+=1
  else:notes.append(merged);added+=1
  by_id[rid]=merged
 d['notes']=notes
 scopes=d.setdefault('institutionScopes',{});scopes['notices:'+firm['id']]=dict(ownerId=owner,module='notices',firmId=firm['id'],identity=identity,observedAccountIdentity=snapshot['observedAccountIdentity'],state='firm_account_verified',complete=True,count=len(records),listScope='observed_list_filter',documentsOpened=False,importedAt=now)
 for k,v in backup['data'].items():
  if k not in ('notes','institutionScopes') and d[k]!=v:raise ValueError('İlgisiz Eworks verisi değişti.')
 return {**backup,'data':d},dict(added=added,updated=updated,total=len(records),otherNotesPreserved=len(backup['data'].get('notes',[])))
