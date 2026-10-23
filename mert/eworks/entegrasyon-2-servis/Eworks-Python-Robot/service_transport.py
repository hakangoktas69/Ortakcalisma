"""Gözlenen sorgu/PDF eylemlerini aynı oturumun HTTP istemcisiyle taşır.

Kaynak kontrolleri, sözleşme doğrulaması, sayfalama ve depo geri okuması korunur.
Şablon, token, PDF ve gövde değerleri tanı dosyasına yazılmaz.
"""
import asyncio
import hashlib
import time
from datetime import date
from urllib.parse import parse_qsl,urlsplit
from declaration_service import source_url,date_format
from declaration_documents import validate_pdf,MAX_BYTES
from local_files import atomic_json
from integration_errors import SourceResponseError,SourceBlockedError

QUERY_FIELDS={'TOKEN','cmd','sorguTipiZ','baslangicTarihi','bitisTarihi',
    'sorguTipiN','sorguTipiT','vergiNo','tcKimlikNo','sorguTipiP',
    'donemBasAy','donemBasYil','donemBitAy','donemBitYil',
    'sorguTipiB','beyannameTanim','sorguTipiV','vdKodu','sorguTipiD','durum'}
TRUE={'on','true','1'}


def validate_query(body,config,aliases):
    if not config or len(body)>65536:raise ValueError('Servis sorgu kapsamı yok.')
    pairs=parse_qsl(body,keep_blank_values=True,strict_parsing=True,max_num_fields=35)
    fields=dict(pairs)
    if len(pairs)!=len(fields) or not set(fields)<=QUERY_FIELDS:
        raise ValueError('Servis sorgu alanları değişti.')
    if not fields.get('TOKEN') or not fields.get('cmd') or fields.get('sorguTipiZ') not in TRUE:
        raise ValueError('Servis sorgu oturumu veya tarih filtresi doğrulanamadı.')
    date_format(fields.get('baslangicTarihi',''),date.fromisoformat(config['startDate']))
    date_format(fields.get('bitisTarihi',''),date.fromisoformat(config['endDate']))
    active=[name for name in ('sorguTipiN','sorguTipiT') if fields.get(name) in TRUE]
    if len(active)!=1:raise ValueError('Servis VKN/TCKN filtresi doğrulanamadı.')
    selected=fields.get('vergiNo' if active[0]=='sorguTipiN' else 'tcKimlikNo')
    if selected not in {config['taxNumber'],*aliases} or len(selected)!=(10 if active[0]=='sorguTipiN' else 11):
        raise ValueError('Servis mükellef kapsamı eşleşmedi.')
    if any(fields.get(name) in TRUE for name in ('sorguTipiB','sorguTipiV','sorguTipiD')):
        raise ValueError('Servis sorgusunda beklenmeyen ek filtre var.')
    if bool(fields.get('sorguTipiP') in TRUE)!=bool(config.get('periodStart')):
        raise ValueError('Servis dönem filtresi eşleşmedi.')
    return fields


class ServiceTransport:
    def __init__(self,context,folder):
        self.context=context;self.folder=folder;self.scope=None;self.aliases=[]
        self.pdf_kind=None;self.pdf_cache={};self.error=None
        self.counts={'queries':0,'pdfs':0,'failures':0}
        self.failure=None;self.failure_key=None;self.failure_details=[]
        self.pattern='https://ebeyanname.gib.gov.tr/dispatch**'

    async def attach(self):
        await self.context.route(self.pattern,self.handle)
        self.context._eworks_service_transport=self

    def begin_scope(self,config,aliases):
        self.scope=dict(config);self.aliases=list(aliases);self.error=None;self.failure=None;self.failure_key=None

    def begin_pdf(self,kind):
        if kind not in ('declaration','tax_accrual','sgk_accrual','sgk_service'):
            raise ValueError('Servis PDF türü doğrulanamadı.')
        self.pdf_kind=kind;self.pdf_cache.clear();self.error=None;self.failure=None;self.failure_key=None

    def end_pdf(self):self.pdf_kind=None;self.pdf_cache.clear()

    def take_pdf(self,url):
        return self.pdf_cache.pop(hashlib.sha256(url.encode()).digest(),None)

    def failure_for(self,url):
        return self.failure if self.failure_key==hashlib.sha256(url.encode()).digest() else None

    def save_summary(self):
        atomic_json(self.folder/'service-transport-summary.json',dict(transport='same_session_http',**self.counts))
        if self.failure_details:atomic_json(self.folder/'service-transport-errors.json',self.failure_details[-100:])

    async def handle(self,route):
        request=route.request
        if not source_url(request.url):return await route.fallback()
        body=request.post_data or ''
        is_query=(request.method=='POST' and self.scope is not None
            and 'baslangicTarihi=' in body and 'bitisTarihi=' in body)
        # Dönem seçeneklerinin servis değerleri ayrıca doğrulanmadı. Bu kapsam
        # eski, doğrulanmış form akışını kullanır; yükleme-tarihi taşımayla karışmaz.
        if is_query and self.scope.get('periodStart'):return await route.fallback()
        p=urlsplit(request.url)
        query=dict(parse_qsl(p.query,keep_blank_values=True))
        is_pdf=(request.method=='GET' and self.pdf_kind is not None and query.get('cmd')=='IMAJ')
        if not is_query and not is_pdf:return await route.fallback()
        upstream=None;stage='scope'
        try:
            if (self.folder/'cancel').exists():raise ValueError('İş iptal edildi.')
            if is_query:validate_query(body,self.scope,self.aliases)
            # route.fetch asıl tarayıcı isteğini henüz sunucuya göndermeden aynı
            # oturumun HTTP istemcisinden BİR kez gönderir; otomatik retry yoktur.
            stage='fetch'
            upstream=await route.fetch(timeout=30000,max_redirects=0,max_retries=0)
            stage='status'
            if upstream.status in (401,403):raise SourceBlockedError('SOURCE_AUTH','GİB oturumu geçersiz; kalan kapsam tamamlanmadı.',upstream.status)
            if upstream.status==429:raise SourceBlockedError('SOURCE_RATE_LIMIT','GİB hız sınırı; tekrar gönderilmedi.',429)
            if upstream.status!=200:raise SourceResponseError('SOURCE_HTTP','GİB servis yanıtı başarısız (HTTP '+str(upstream.status)+').',upstream.status)
            if not source_url(upstream.url):raise SourceResponseError('SOURCE_ORIGIN','GİB servis yanıtının kaynağı doğrulanamadı.')
            stage='body'
            mime=upstream.headers.get('content-type','').lower()
            limit=MAX_BYTES if is_pdf else 2_000_000
            length=upstream.headers.get('content-length','')
            if length.isdigit() and int(length)>limit:raise ValueError('GİB servis yanıtı boyut sınırını aştı.')
            raw=await upstream.body()
            if len(raw)>limit:raise ValueError('GİB servis yanıtı boyut sınırını aştı.')
            if is_query:
                if not mime.startswith('text/html'):raise ValueError('GİB sorgu yanıt türü değişti.')
                self.counts['queries']+=1
            else:
                # Kaynak kayıt-yok / hız uyarısı HTML'ini mevcut hata sınıflayıcıya
                # bırak; HTML hiçbir zaman PDF olarak depolanmaz.
                if raw.startswith(b'%PDF-'):
                    stage='pdf_validation'
                    validate_pdf(raw)
                    self.pdf_cache[hashlib.sha256(request.url.encode()).digest()]=raw
                    self.counts['pdfs']+=1
            self.save_summary()
            # Kaynak gövde aynen tarayıcıya döner; mevcut tablo/sayfalama ve
            # belge-kayıt kimliği kontrolleri bundan sonra yine zorunludur.
            stage='fulfill'
            await route.fulfill(response=upstream,body=raw)
        except Exception as exc:
            self.counts['failures']+=1
            if isinstance(exc,(SourceResponseError,SourceBlockedError)):failure=exc
            elif stage=='scope':failure=SourceResponseError('SOURCE_SCOPE','Servis istek kapsamı doğrulanamadı; istek gönderilmedi.')
            elif 'timeout' in type(exc).__name__.lower():failure=SourceResponseError('SOURCE_TIMEOUT','GİB servis isteği zaman aşımına uğradı.')
            else:failure=SourceResponseError('SOURCE_TRANSPORT','GİB servis taşıması tamamlanamadı ('+stage+').')
            self.failure=failure;self.failure_key=hashlib.sha256(request.url.encode()).digest()
            self.error=str(failure)
            self.failure_details.append(dict(at=time.time(),code=failure.code,stage=stage,
                operation='query' if is_query else 'pdf',kind=self.pdf_kind if is_pdf else None,
                status=getattr(failure,'status',None) or (upstream.status if upstream is not None else None),errorType=type(exc).__name__))
            self.save_summary()
            await route.fulfill(status=502,content_type='text/plain',body='Eworks: source response not verified.')
        finally:
            if upstream is not None:await upstream.dispose()

    async def close(self):
        await self.context.unroute(self.pattern,self.handle)
        self.scope=None;self.aliases.clear();self.end_pdf()
        self.context._eworks_service_transport=None
