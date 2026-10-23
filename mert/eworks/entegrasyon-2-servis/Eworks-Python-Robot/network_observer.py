"""GİB trafik şeması: değer, çerez, parola, token veya ham gövde kaydetmez."""
import asyncio
import json
from urllib.parse import urlsplit, parse_qsl
from local_files import atomic_json

HOSTS={'dijital.gib.gov.tr','ebeyanname.gib.gov.tr','intvrg.gib.gov.tr'}
# Bilinmeyen yol kişisel tanımlayıcı taşıyabilir; açık izin olmadan yazılmaz.
PATHS={'/','/portal','/portal/login','/dispatch','/apigateway/auth/tdvd/login'}
FIELDS=set('dk imageId sifre userid messages result token data success error errors code message status cmd TOKEN '
    'sorguTipiN vergiNo sorguTipiT tcKimlikNo sorguTipiB beyannameTanim sorguTipiP donemBasAy donemBasYil '
    'donemBitAy donemBitYil sorguTipiV vdKodu sorguTipiZ baslangicTarihiGun baslangicTarihiAy '
    'baslangicTarihiYil baslangicTarihi bitisTarihiGun bitisTarihiAy bitisTarihiYil bitisTarihi '
    'sorguTipiD durum sorgulaButon'.split())
HEADERS={'accept','content-type','authorization','cookie','origin','referer','x-requested-with',
         'content-length','cache-control','set-cookie','location'}
MIMES={'application/json','text/json','text/html','text/plain','application/x-www-form-urlencoded',
       'multipart/form-data','application/pdf','application/octet-stream'}
MAX_BODY=65536


def endpoint(url):
    try:
        p=urlsplit(url)
        if p.scheme!='https' or p.hostname not in HOSTS or p.port not in (None,443) or p.username or p.password:return None
        return dict(origin='https://'+p.hostname,path=p.path if p.path in PATHS else '[unlisted-path]')
    except (ValueError,TypeError):return None


def names(values):
    values=list(values)
    return dict(names=sorted({v for v in values if v in FIELDS}),unlistedCount=sum(v not in FIELDS for v in values))


def mime(value):
    value=(value or '').split(';')[0].strip().lower()
    return value if value in MIMES else 'other'


def shape(value,depth=0):
    # Yalnız sabit tür adları ve izin verilen anahtarlar çıkar; scalar değer yok.
    if depth>=3:return {'type':'depth-limit'}
    if isinstance(value,dict):
        allowed=sorted(k for k in value if k in FIELDS)
        return dict(type='object',fields={k:shape(value[k],depth+1) for k in allowed[:40]},
                    unlistedCount=sum(k not in FIELDS for k in value))
    if isinstance(value,list):return dict(type='array',length=len(value))
    if value is None:return {'type':'null'}
    if isinstance(value,bool):return {'type':'boolean'}
    if isinstance(value,(int,float)):return {'type':'number'}
    return {'type':'string'}


def request_schema(request):
    ep=endpoint(request.url)
    if not ep or request.resource_type not in {'document','xhr','fetch'}:return None
    method=request.method if request.method in {'GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'} else 'other'
    headers=request.headers
    content=mime(headers.get('content-type'))
    item=dict(**ep,method=method,resourceType=request.resource_type,
              query=names(k for k,_ in parse_qsl(urlsplit(request.url).query,keep_blank_values=True)),
              headerNames=sorted(k.lower() for k in headers if k.lower() in HEADERS),contentType=content)
    body=request.post_data
    if body and len(body)<=MAX_BODY:
        try:
            if content in {'application/json','text/json'}:item['bodyShape']=shape(json.loads(body))
            elif content=='application/x-www-form-urlencoded':item['bodyFields']=names(k for k,_ in parse_qsl(body,keep_blank_values=True))
            else:item['bodyShape']={'type':'not-inspected'}
        except (ValueError,TypeError):item['bodyShape']={'type':'unrecognized'}
    elif body:item['bodyShape']={'type':'size-limit'}
    return item


class NetworkObserver:
    def __init__(self,folder,max_records=250):
        self.path=folder/'network-schema.json';self.records=[];self.limit=max_records
        self.dropped=0;self.tasks=set();self.pending={};self.context=None

    def flush(self):
        try:atomic_json(self.path,dict(schema='eworks.gib.network-schema.v1',
            policy='allowlisted names and structural types only; no values',records=self.records,dropped=self.dropped))
        except OSError:pass # Tanı hatası asıl işi durdurmaz; ham hata mesajı yazılmaz.

    def attach(self,context):
        self.context=context
        context.on('request',self.on_request)
        context.on('response',self.on_response)
        self.flush()

    def on_request(self,request):
        try:
            if len(self.records)>=self.limit:self.dropped+=1;return
            item=request_schema(request)
            if item is None:return
            item['sequence']=len(self.records)+1;self.records.append(item)
            self.pending[id(request)]=item
            self.flush()
        except Exception:pass

    def on_response(self,response):
        if id(response.request) not in self.pending:return
        if len(self.tasks)>=8:self.pending.pop(id(response.request),None);self.dropped+=1;return
        task=asyncio.create_task(self.inspect_response(response));self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def inspect_response(self,response):
        item=self.pending.pop(id(response.request),None)
        if item is None:return
        try:
            headers=response.headers
            content=mime(headers.get('content-type'))
            item['response']=dict(status=response.status,contentType=content,
                headerNames=sorted(k.lower() for k in headers if k.lower() in HEADERS))
            # Playwright body() tüm yanıtı belleğe alır: uzunluğu ilan edilmeyen
            # veya büyük yanıtın içeriğini hiç okumuyoruz.
            size=headers.get('content-length','')
            if content in {'application/json','text/json'} and size.isdigit() and 0<int(size)<=MAX_BODY:
                raw=await asyncio.wait_for(response.body(),timeout=3)
                if len(raw)<=MAX_BODY:
                    try:item['response']['bodyShape']=shape(json.loads(raw))
                    except (ValueError,UnicodeError):item['response']['bodyShape']={'type':'unrecognized'}
            else:item['response']['bodyShape']={'type':'not-inspected'}
        except Exception:
            item.setdefault('response',{})['inspection']='unavailable'
        finally:self.flush()

    async def close(self):
        if self.context:
            self.context.remove_listener('request',self.on_request)
            self.context.remove_listener('response',self.on_response)
        if self.tasks:
            done,pending=await asyncio.wait(list(self.tasks),timeout=4)
            for t in pending:t.cancel()
            if pending:await asyncio.gather(*pending,return_exceptions=True)
        self.pending.clear();self.flush()
