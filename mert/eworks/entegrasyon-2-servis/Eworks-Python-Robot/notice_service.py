"""Gözlenen e-Tebligat liste isteğini aynı oturumda salt okunur sayfalar.
Belge açma/okundu işaretleme uç noktaları kullanılmaz; oturum başlıkları diske yazılmaz.
"""
import asyncio,copy,json,math,re
from datetime import datetime
from hashlib import sha256
from urllib.parse import urlsplit
from local_files import atomic_json
LIST_PATH='/apigateway/etebligat/etebligat/tebligat-listele'

def listing_url(url):
 u=urlsplit(url)
 return u.scheme=='https' and u.hostname=='dijital.gib.gov.tr' and u.port in (None,443) and not u.username and not u.password and u.path==LIST_PATH and not u.query and not u.fragment

def date_value(v,required=False):
 if v in (None,'','-','—'):
  if required:raise ValueError('Tebligat gönderim tarihi eksik.')
  return None
 if not isinstance(v,str):raise ValueError('Tebligat tarih türü değişti.')
 for fmt in ('%Y-%m-%dT%H:%M:%S.%f','%Y-%m-%dT%H:%M:%S','%Y-%m-%d %H:%M:%S','%d.%m.%Y %H:%M:%S','%d.%m.%Y %H:%M','%d.%m.%Y','%d/%m/%Y %H:%M:%S','%d/%m/%Y %H:%M','%d/%m/%Y'):
  try:return datetime.strptime(v,fmt).date().isoformat()
  except ValueError:pass
 try:return datetime.fromisoformat(v.replace('Z','+00:00')).date().isoformat()
 except ValueError:
  pattern=re.sub(r'[A-Za-zÇĞİÖŞÜçğıöşü]', 'L', re.sub(r'[0-9]','D',v))[:80]
  raise ValueError('Tebligat tarih biçimi doğrulanamadı: '+pattern) from None

def page_data(value):
 if not isinstance(value,dict) or not isinstance(value.get('data'),dict) or not isinstance(value.get('pageDetail'),dict):raise ValueError('Tebligat liste sözleşmesi değişti.')
 d=value['data'];p=value['pageDetail'];rows=d.get('tebligatDtoList');total=p.get('total');count=d.get('count')
 if not isinstance(rows,list) or type(total) is not int or not 0<=total<=10000 or type(count) is not int or count!=total:raise ValueError('Tebligat toplamı doğrulanamadı.')
 if any(type(p.get(k)) is not int for k in ('pageNo','pageSize','totalPage')):raise ValueError('Tebligat sayfalaması doğrulanamadı.')
 if not 1<=p['pageSize']<=1000 or p['totalPage']!=math.ceil(total/p['pageSize']):raise ValueError('Tebligat sayfa toplamı tutarsız.')
 if len(rows)>p['pageSize']:raise ValueError('Tebligat sayfa boyutu tutarsız.')
 return rows,p

def record(row,identity):
 if not isinstance(row,dict):raise ValueError('Tebligat kaydı geçersiz.')
 required=('tebligId','belgeNo','belgeTuruAciklama','kurumAciklama')
 if any(not isinstance(row.get(k),str) or not row[k].strip() for k in required):raise ValueError('Tebligat kimlik alanı eksik.')
 sent=date_value(row.get('gonderimZamani'),True);read=date_value(row.get('mukellefOkumaZamani'))
 return dict(recordId=sha256((identity+'|'+row['tebligId']).encode()).hexdigest(),identity=identity,reference=row['belgeNo'],document=row['belgeTuruAciklama'],sender=row['kurumAciklama'],department=str(row.get('altKurum') or ''),date=sent,period=sent[:7],deliveryDate=date_value(row.get('tebligZamani')),readDate=read,status='Okunmuş' if read else 'Okuma tarihi yok')

def page_cursor(payload):
 found=[]
 def walk(v,path):
  if isinstance(v,dict):
   for k,x in v.items():
    if k=='pageNo' and type(x) is int:found.append(path+[k])
    elif isinstance(x,dict):walk(x,path+[k])
 walk(payload,[])
 if len(found)!=1:raise ValueError('Gözlenen servis isteğinde tekil sayfa alanı yok.')
 return found[0]

class NoticeListCollector:
 def __init__(self,folder):self.folder=folder;self.first=None;self.request=None
 async def observe(self,response):
  if self.first is not None or not listing_url(response.url) or response.status!=200:return
  if response.request.method!='POST' or 'json' not in response.headers.get('content-type',''):return
  try:
   raw=await response.body()
   if len(raw)>2_000_000:return
   value=json.loads(raw);page_data(value)
   self.first=value;self.request=response.request
  except (ValueError,TypeError):return
 async def collect(self,context,owner,firm_id,identity,observed_identity,verified_identities):
  if observed_identity not in verified_identities or identity not in verified_identities:raise ValueError('Tebligat hesap kapsamı doğrulanamadı.')
  if self.first is None:return dict(state='list_response_unavailable',complete=False,count=None)
  rows,detail=page_data(self.first);all_rows=list(rows);page_no=detail['pageNo'];total=detail['total']
  if page_no not in (0,1):raise ValueError('Tebligat ilk sayfası doğrulanamadı.')
  if len(all_rows)<total:
   payload=json.loads(self.request.post_data);cursor=page_cursor(payload);node=payload
   for key in cursor:node=node[key]
   if node!=page_no:raise ValueError('Tebligat sayfa isteği ve yanıtı eşleşmedi.')
   headers={k:v for k,v in (await self.request.all_headers()).items() if k.lower() not in ('content-length','host','connection')}
   for _ in range(1000):
    if len(all_rows)>=total:break
    if (self.folder/'cancel').exists():raise ValueError('Tebligat kontrolü iptal edildi.')
    await asyncio.sleep(1.5)
    page_no+=1;body=copy.deepcopy(payload);node=body
    for key in cursor[:-1]:node=node[key]
    node[cursor[-1]]=page_no
    reply=await context.request.fetch(self.request.url,method='POST',headers=headers,data=json.dumps(body),timeout=20000)
    if reply.status!=200:raise ValueError('Tebligat sayfası alınamadı.')
    value=await reply.json();more,p=page_data(value)
    if p['total']!=total or p['pageSize']!=detail['pageSize'] or p['pageNo']!=page_no or not more:raise ValueError('Tebligat sayfa kapsamı değişti.')
    all_rows.extend(more)
   headers.clear()
  if len(all_rows)!=total:raise ValueError('Tebligat liste toplamı tamamlanamadı.')
  records=[record(r,identity) for r in all_rows]
  if len({r['recordId'] for r in records})!=total:raise ValueError('Tebligat tekrar eden kayıt içeriyor.')
  snapshot=dict(schema='eworks.notice-list.v1',ownerId=owner,firmId=firm_id,identity=identity,observedAccountIdentity=observed_identity,accountVerified=True,sourceURL='https://dijital.gib.gov.tr'+LIST_PATH,scope='observed_list_filter',complete=True,count=total,records=records,documentsOpened=False,imported=False)
  atomic_json(self.folder/'notice-list-result.json',snapshot)
  return dict(state='observed_list_verified',complete=True,count=total,documentsOpened=False,imported=False)
