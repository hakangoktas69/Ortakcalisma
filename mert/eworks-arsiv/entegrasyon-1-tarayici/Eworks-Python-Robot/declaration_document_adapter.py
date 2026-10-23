"""GİB'de gözlenen satır içi PDF görüntüleme kontrollerini indirir."""
import asyncio
import re
from pathlib import Path
from urllib.parse import urlsplit
from declaration_documents import validate_pdf, MAX_BYTES
from institution_discovery import safe_origin
from local_files import atomic_json
from source_record_id import source_id,action_ids

TITLES={
 'declaration':'Beyannameyi PDF Formatında görüntülemek için tıklayınız.',
 'tax_accrual':'Tahakkuku PDF Formatında görüntülemek için tıklayınız.',
}

class DocumentUnavailable(ValueError):
    """Kaynak sistem belgeyi kayıt yok yanıtıyla sunmadı."""

def source_document_error(text):
    from advisor_records import normalized
    value=' '.join(normalized(re.sub(r'<[^>]+>',' ',text)).split())
    if 'ebil_gd_bildirge kayit yok' in value:
        return DocumentUnavailable('GİB/SGK: EBIL_GD_BILDIRGE Kayıt Yok; belge sunulmadı.')
    if 'hizmet dokumunu goruntuleyemezsiniz. sgk mesaji: islem basarisiz!' in value:
        return DocumentUnavailable('GİB/SGK hizmet dökümünü sunamadı: İşlem Başarısız.')
    return None

def trusted_pdf_source(url):
    value=urlsplit(url)
    return value.scheme=='https' and value.hostname=='ebeyanname.gib.gov.tr' and value.port in (None,443) and not value.username and not value.password

async def download_one(frame,target,kind,folder):
    page=frame.page;context=page.context;before=set(context.pages)
    completed=asyncio.Queue();tasks=set();responses=[]
    async def pace():
        while True:
            last=getattr(context,'_eworks_pdf_request_at',0)
            remaining=2.2-(asyncio.get_running_loop().time()-last)
            if remaining<=0:break
            await asyncio.sleep(remaining)
        context._eworks_pdf_request_at=asyncio.get_running_loop().time()
    async def response_body(response):
        if not trusted_pdf_source(response.url):return
        context._eworks_pdf_request_at=asyncio.get_running_loop().time()
        mime=(response.headers.get('content-type') or '').lower()
        diagnostic=dict(status=response.status,mime=mime,path=urlsplit(response.url).path,method=response.request.method)
        responses.append(diagnostic)
        if response.status==200 and 'text/html' in mime:
            try:
                body=await response.text()
                if len(body)<20000:
                    from advisor_records import normalized
                    plain=' '.join(re.sub(r'<[^>]+>',' ',body).split())
                    plain=re.sub(r'[A-Za-z0-9_-]{20,}|\d{10,11}','[redacted]',plain)
                    diagnostic['errorText']=plain[:500]
                source_error=source_document_error(body) if len(body)<20000 else None
                if source_error:await completed.put(source_error)
            except Exception:pass
            return
        if response.status!=200 or not any(t in mime for t in ('application/pdf','application/octet-stream')):return
        try:
            length=response.headers.get('content-length','0')
            if length.isdigit() and int(length)>MAX_BYTES:return
            try:
                raw=await response.body();validate_pdf(raw)
            except Exception:
                # Chrome'un PDF görüntüleyicisi gövdeyi devralabilir. Yalnızca
                # az önce gözlenen görüntüleme isteğini aynı oturumda tekrar oku.
                await pace()
                copied=await context.request.fetch(response.request,max_redirects=0,timeout=30000)
                if copied.status!=200:raise ValueError('PDF yanıtı alınamadı.')
                raw=await copied.body();await copied.dispose()
                from advisor_records import normalized
                warning=normalized(raw.decode('utf-8',errors='replace')) if not raw.startswith(b'%PDF-') and len(raw)<10000 else ''
                if 'iki goruntuleme istegi arasi en az 1 sn olabilir.' in warning:
                    await pace()
                    copied=await context.request.fetch(response.request,max_redirects=0,timeout=30000)
                    if copied.status!=200:raise ValueError('PDF yanıtı alınamadı.')
                    raw=await copied.body();await copied.dispose()
            diagnostic['bytes']=len(raw)
            diagnostic['pdfHeader']=raw.startswith(b'%PDF-')
            diagnostic['eof']=b'%%EOF' in raw[-4096:]
            if not raw.startswith(b'%PDF-') and len(raw)<10000:
                try:text=raw.decode('utf-8')
                except UnicodeDecodeError:text=raw.decode('iso-8859-9',errors='replace')
                text=re.sub(r'<script\b[^>]*>.*?</script>','',text,flags=re.S|re.I)
                text=re.sub(r'<[^>]+>',' ',text)
                text=re.sub(r'[A-Za-z0-9_-]{20,}','[redacted]',text)
                text=re.sub(r'\d{10,11}','[identity]',text)
                diagnostic['errorText']=' '.join(text.split())[:500]
            validate_pdf(raw);await completed.put(raw)
        except Exception as exc:diagnostic['failureType']=type(exc).__name__
    async def download_body(download):
        if not trusted_pdf_source(download.url):return
        try:
            location=await download.path()
            if location:
                path=Path(location)
                if path.stat().st_size>MAX_BYTES:return
                raw=await asyncio.to_thread(path.read_bytes);validate_pdf(raw);await completed.put(raw)
        except Exception:pass
    def schedule(coro):
        task=asyncio.create_task(coro);tasks.add(task);task.add_done_callback(tasks.discard)
    def on_response(response):schedule(response_body(response))
    def on_download(download):schedule(download_body(download))
    def on_page(new_page):new_page.on('download',on_download)
    context.on('response',on_response);context.on('page',on_page)
    for p in before:p.on('download',on_download)
    try:
        await pace()
        await target.click(timeout=5000)
        try:
            result=await asyncio.wait_for(completed.get(),timeout=40)
            if isinstance(result,Exception):raise result
            return result
        except asyncio.TimeoutError:
            atomic_json(folder/'document-download-diagnostic.json',dict(kind=kind,responses=responses,
                pages=[dict(origin=safe_origin(p.url),path=urlsplit(p.url).path) for p in context.pages if p not in before]))
            raise ValueError('GİB PDF yanıtı alınamadı; dosya kaydedilmedi.') from None
    finally:
        context.remove_listener('response',on_response);context.remove_listener('page',on_page)
        for p in context.pages:
            p.remove_listener('download',on_download)
            if p not in before and not p.is_closed() and trusted_pdf_source(p.url):await p.close()
        for task in tuple(tasks):task.cancel()
        if tasks:await asyncio.gather(*tasks,return_exceptions=True)

async def download_documents(frame,row,folder,report):
    if not trusted_pdf_source(frame.url):raise ValueError('Belge kaynağı doğrulanamadı.')
    import json
    if not (folder/'query-form-structure.json').exists():
        atomic_json(folder/'query-form-structure.json',await frame.locator('input[name],select[name]').evaluate_all("els=>els.map(el=>({name:el.name,type:el.type,tag:el.tagName,maxLength:el.maxLength}))"))
    import importlib,declaration_sync,institution_discovery,declaration_adapter,declaration_reader,source_record_id
    importlib.reload(source_record_id)
    importlib.reload(declaration_adapter);importlib.reload(declaration_reader)
    declaration_reader._DIAGNOSTIC_FOLDER=folder
    navigation=importlib.reload(institution_discovery)
    aliases_path=folder/'live-contract-aliases.json'
    if aliases_path.exists():navigation._LIVE_QUERY_ALIASES=json.loads(aliases_path.read_text(encoding='utf-8')).get('aliases',{})
    declaration_sync.declaration_pilot_query=navigation.declaration_pilot_query
    request=json.loads((folder/'request.json').read_text(encoding='utf-8')) if (folder/'request.json').exists() else {}
    if request.get('documentScope')=='sgk':
        row.setdefault('metadata',{})['documentDownloadScope']='sgk_only'
        return []
    statuses=await frame.locator('table').evaluate_all('''tables=>[...new Set(tables.flatMap(t=>Array.from(t.rows).slice(1).filter(r=>r.cells.length===10).map(r=>(r.cells[8].innerText||r.cells[8].textContent||'').trim())))].filter(s=>s&&s.length<100)''')
    atomic_json(folder/'document-status-labels.json',statuses)
    raw_source_id=source_id(row)
    target=frame.locator('[id="row'+raw_source_id+'"]')
    if await target.count()!=1 or not await target.is_visible():raise ValueError('Belge satırı görünür değil.')
    documents=[];errors=[]
    for kind,title in TITLES.items():
        control=target.locator('img[title="'+title+'"]')
        if await control.count()==0:continue
        if await control.count()!=1 or not await control.is_visible():raise ValueError('PDF kontrolü tekil değil.')
        action=await control.get_attribute('onclick') or ''
        function='beyannameGoruntule' if kind=='declaration' else 'tahakkukGoruntule'
        if not any(re.fullmatch(function+r"\('"+re.escape(oid)+r"'(?:,'[A-Za-z0-9_-]{1,100}')?,\s*(?:true|false),\s*(?:true|false)\)",action) for oid in action_ids(raw_source_id)):
            raise ValueError('PDF kontrolünün kaynak kayıt kimliği eşleşmedi.')
        if any(f.get('kind')==kind for f in row.get('attachments',[])):continue
        report(folder,'running','GİB '+('beyanname' if kind=='declaration' else 'tahakkuk')+' PDF dosyası indiriliyor.')
        try:
            raw=await download_one(frame,control,kind,folder)
            documents.append((kind,raw))
        except ValueError as exc:errors.append(str(exc))
        await asyncio.sleep(1.5)
    if errors:row['documentWarnings']=errors
    if errors and not documents:raise ValueError(' '.join(errors))
    return documents
