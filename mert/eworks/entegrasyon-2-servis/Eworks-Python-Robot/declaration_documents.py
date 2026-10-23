"""Gerçek GİB PDF'lerini doğrular, özel depoda değişmez dosya olarak saklar."""
import asyncio
import hashlib
import io
import re
from datetime import datetime, timezone
from uuid import UUID
import requests
from pypdf import PdfReader
from cloud_credentials import URL, PUBLISHABLE_KEY
from local_files import atomic_json
from integration_errors import SessionBudgetExceeded, SourceBlockedError, StorageResponseError
from session_guard import SessionGuard

BUCKET='eworks-declarations'
MAX_BYTES=20*1024*1024
KINDS={'declaration':'Beyanname','tax_accrual':'Vergi tahakkuku','sgk_accrual':'SGK tahakkuku','sgk_service':'SGK hizmet listesi'}

class KnownDocuments(dict):
    pass

def known_documents(owner,access_token):
    try:
        response=requests.get(URL+'/rest/v1/eworks_state',params={'select':'payload','user_id':'eq.'+str(UUID(owner))},
            headers={'apikey':PUBLISHABLE_KEY,'Authorization':'Bearer '+access_token},timeout=30,allow_redirects=False)
        if response.status_code!=200:raise ValueError()
        states=response.json();notes=states[0]['payload'].get('notes',[]) if states else []
        known=KnownDocuments({(r.get('identity'),r.get('recordId')):r.get('attachments',[]) for r in notes
            if r.get('ownerId')==owner and ((r.get('sourceType')=='gib_live' and r.get('page')=='declarations-view') or (r.get('sourceType')=='gib_muhsgk' and r.get('page')=='sgk-bildirge'))}
        )
        known.employee_counts={}
        for row in notes:
            if row.get('ownerId')!=owner:continue
            proof=row.get('metadata',{}).get('employeeCountSource',{})
            count=row.get('metadata',{}).get('employeeCount')
            if (type(count) is not int or not 0<=count<=100000 or proof.get('employeeCount')!=count
                    or proof.get('method')!='sgk_service_unique_persons'
                    or proof.get('identity')!=row.get('identity') or proof.get('recordId')!=row.get('recordId')):continue
            for f in known.get((row.get('identity'),row.get('recordId')),[]):
                if (f.get('kind')=='sgk_service' and f.get('storageVerified') is True
                        and f.get('ownerId')==owner and f.get('identity')==row.get('identity') and f.get('recordId')==row.get('recordId')
                        and isinstance(f.get('sha256'),str) and re.fullmatch('[a-f0-9]{64}',f['sha256'])
                        and f['sha256']==proof.get('sourceSha256')):
                    known.employee_counts[(row['identity'],row['recordId'],f['sha256'])]=count
        return known
    except (requests.RequestException,ValueError,KeyError,TypeError,IndexError):
        raise ValueError('Kayıtlı belge listesi alınamadı; mevcut dosyalar korunuyor.') from None

def verified_existing(files,*,owner,identity,record_id,access_token):
    current={}
    for f in sorted(files,key=lambda f:f.get('savedAt','')):
        if (f.get('ownerId')!=owner or f.get('identity')!=identity or f.get('recordId')!=record_id
                or f.get('bucket')!=BUCKET or f.get('kind') not in KINDS or not re.fullmatch(r'[a-f0-9]{64}',f.get('sha256',''))
                or f.get('key')!=f'{owner}/{identity}/{record_id}/{f.get("kind")}-{f.get("sha256")}.pdf'):
            raise ValueError('Kayıtlı belgenin sahibi veya kayıt kapsamı doğrulanamadı.')
        current[f['kind']]=f
    confirmed=[]
    for f in current.values():
        try:
            response=requests.get(URL+'/storage/v1/object/authenticated/'+BUCKET+'/'+f['key'],
                headers={'apikey':PUBLISHABLE_KEY,'Authorization':'Bearer '+access_token},timeout=30,allow_redirects=False)
            if response.status_code==404:continue
            if response.status_code in (401,403):raise SourceBlockedError('STORAGE_AUTH',f'Belge deposu erişimi durdu (HTTP {response.status_code}).',response.status_code)
            if response.status_code!=200:raise ValueError('Kayıtlı belge doğrulanamadı.')
            if validate_pdf(response.content)!=f['sha256'] or len(response.content)!=f['size']:raise ValueError('Kayıtlı belgenin dosya özeti uyuşmuyor.')
            if f['kind']=='sgk_service':
                from sgk_employee_count import service_employee_count
                f=dict(f,employeeCount=service_employee_count(response.content))
            confirmed.append(f)
        except requests.RequestException:raise ValueError('Kayıtlı belge bağlantısı tamamlanamadı.') from None
    return confirmed

def validate_pdf(raw):
    if not isinstance(raw,bytes) or not 100<=len(raw)<=MAX_BYTES or not raw.startswith(b'%PDF-') or b'%%EOF' not in raw[-4096:]:
        raise ValueError('İndirilen yanıt geçerli PDF değil; belge kaydedilmedi.')
    try:
        reader=PdfReader(io.BytesIO(raw),strict=False)
        if reader.is_encrypted or not 1<=len(reader.pages)<=2000:raise ValueError()
        for page in reader.pages:page.mediabox
    except Exception:raise ValueError('PDF okunamadı; belge kaydedilmedi.') from None
    return hashlib.sha256(raw).hexdigest()

def store_pdf(raw,*,owner,identity,record_id,kind,access_token):
    SessionGuard(access_token).check_storage()
    owner=str(UUID(owner))
    if not re.fullmatch(r'\d{10,11}',identity) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',record_id) or kind not in KINDS:
        raise ValueError('Belge kayıt kapsamı doğrulanamadı.')
    digest=validate_pdf(raw)
    key=f'{owner}/{identity}/{record_id}/{kind}-{digest}.pdf'
    headers={'apikey':PUBLISHABLE_KEY,'Authorization':'Bearer '+access_token}
    endpoint=URL+'/storage/v1/object/'+BUCKET+'/'+key
    try:
        response=requests.post(endpoint,headers={**headers,'Content-Type':'application/pdf','x-upsert':'false'},data=raw,timeout=45,allow_redirects=False)
        if response.status_code in (401,403):raise SourceBlockedError('STORAGE_AUTH',f'Belge deposu erişimi durdu (HTTP {response.status_code}).',response.status_code)
        # Aynı içerik zaten varsa yalnız geri okuma aynı özeti doğrularsa kabul et.
        if response.status_code not in (200,201,409):
            try:duplicate=response.status_code==400 and response.json().get('error')=='Duplicate'
            except ValueError:duplicate=False
            if not duplicate:raise StorageResponseError('STORAGE_UPLOAD',f'Belge deposuna yüklenemedi (HTTP {response.status_code}).',response.status_code)
        check=requests.get(URL+'/storage/v1/object/authenticated/'+BUCKET+'/'+key,headers=headers,timeout=45,allow_redirects=False)
        if check.status_code in (401,403):raise SourceBlockedError('STORAGE_AUTH',f'Belge deposu erişimi durdu (HTTP {check.status_code}).',check.status_code)
        if check.status_code!=200:
            raise StorageResponseError('STORAGE_READBACK',f'Belge deposundan geri okunamadı (HTTP {check.status_code}).',check.status_code)
        if hashlib.sha256(check.content).hexdigest()!=digest:
            raise ValueError('Belge deposundan geri okuma doğrulanamadı.')
    except requests.RequestException:raise StorageResponseError('STORAGE_CONNECTION','Belge deposu bağlantısı tamamlanamadı.') from None
    return dict(kind=kind,label=KINDS[kind],bucket=BUCKET,key=key,sha256=digest,size=len(raw),
        contentType='application/pdf',filename=f'{kind}-{record_id}.pdf',savedAt=datetime.now(timezone.utc).isoformat(),
        ownerId=owner,identity=identity,recordId=record_id,storageVerified=True)

class DocumentCollector:
    def __init__(self,folder,owner,access_token,report,known=None):
        self.folder=folder;self.owner=owner;self.access_token=access_token;self.report=report
        self.failures=[]
        self.known=known or {}
        self.employee_count_updates={}
        self.session_guard=SessionGuard(access_token)
        self.retry_targets=None

    def remember_employee_count(self,identity,record_id,attachment):
        count=attachment.get('employeeCount')
        if type(count) is int and 0<=count<=100000:
            self.employee_count_updates[(identity,record_id)]=dict(identity=identity,recordId=record_id,
                employeeCount=count,sourceSha256=attachment['sha256'],method='sgk_service_unique_persons')

    async def load_cached_employee_counts(self):
        for (identity,record_id),files in self.known.items():
            service=[f for f in files if f.get('kind')=='sgk_service']
            if not service:continue
            pending=[]
            for f in service:
                count=getattr(self.known,'employee_counts',{}).get((identity,record_id,f.get('sha256')))
                if type(count) is int:
                    self.remember_employee_count(identity,record_id,{**f,'employeeCount':count})
                else:pending.append(f)
            if not pending:continue
            verified=await asyncio.to_thread(verified_existing,pending,owner=self.owner,identity=identity,
                record_id=record_id,access_token=self.access_token)
            for f in verified:self.remember_employee_count(identity,record_id,f)

    async def collect(self,frame,rows):
        """Adaptör yalnız doğrulanmış mevcut liste satırının görüntüleme kontrolünü kullanır."""
        # Canlı uygulamanın kontrol yapısı gözlenmeden URL/JavaScript uydurulmaz.
        import importlib, declaration_document_adapter
        importlib.invalidate_caches()
        adapter=importlib.reload(declaration_document_adapter)
        for row in rows:
            modules=self.retry_targets.get((row['identity'],row['recordId']),set()) if self.retry_targets is not None else {'declaration','sgk'}
            if not modules:continue
            self.session_guard.check_source()
            if (self.folder/'cancel').exists():raise ValueError('İş iptal edildi.')
            row['attachments']=[]
            try:
                row['attachments']=await asyncio.to_thread(verified_existing,self.known.get((row['identity'],row['recordId']),[]),
                    owner=self.owner,identity=row['identity'],record_id=row['recordId'],access_token=self.access_token)
                documents=await adapter.download_documents(frame,row,self.folder,self.report) if 'declaration' in modules else []
                errors=row.pop('documentWarnings',[])
                for kind,raw in documents:
                    attachment=await asyncio.to_thread(store_pdf,raw,owner=self.owner,identity=row['identity'],
                        record_id=row['recordId'],kind=kind,access_token=self.access_token)
                    row['attachments'].append(attachment)
                    atomic_json(self.folder/'document-checkpoint.json',dict(ownerId=self.owner,
                        sourceJobId=self.folder.name,records=[dict(identity=row['identity'],recordId=row['recordId'],attachments=row['attachments'])]))
                row['documentStatus']='partial' if errors else 'saved' if row['attachments'] else 'unavailable'
                if row.get('metadata',{}).get('documentDownloadScope')=='sgk_only' and not row['attachments']:row['documentStatus']='not_downloaded'
                if errors:
                    row['documentError']=' '.join(errors)
                    self.failures.append(dict(identity=row['identity'],recordId=row['recordId'],message=row['documentError']))
            except (SessionBudgetExceeded, SourceBlockedError):raise
            except Exception as exc:
                row['documentStatus']='failed'
                row['documentError']=str(exc) if isinstance(exc,ValueError) else 'Belge indirme tamamlanamadı ('+type(exc).__name__+').'
                self.failures.append(dict(identity=row['identity'],recordId=row['recordId'],message=row['documentError']))
                self.failures[-1].update(code=getattr(exc,'code',type(exc).__name__),httpStatus=getattr(exc,'status',None))
            if row.get('document')=='MUHSGK' and 'sgk' in modules:
                try:
                    import importlib,muhsgk_sgk_adapter
                    sgk_adapter=importlib.reload(muhsgk_sgk_adapter)
                    async def existing_sgk(child):
                        return await asyncio.to_thread(verified_existing,self.known.get((row['identity'],child['recordId']),[]),
                            owner=self.owner,identity=row['identity'],record_id=child['recordId'],access_token=self.access_token)
                    row['sgkRecords']=await sgk_adapter.collect_sgk(frame,row,self.folder,self.report,existing_sgk)
                    for child in row['sgkRecords']:
                        if child.get('identity')!=row['identity'] or child.get('parentRecordId')!=row['recordId']:
                            raise ValueError('SGK belgesi kaynak MUHSGK kaydıyla eşleşmedi.')
                        child['attachments']=await asyncio.to_thread(verified_existing,self.known.get((row['identity'],child['recordId']),[]),
                            owner=self.owner,identity=row['identity'],record_id=child['recordId'],access_token=self.access_token)
                        for kind,raw in child.pop('_pdfs',[]):
                            if kind not in ('sgk_accrual','sgk_service'):raise ValueError('SGK belge türü doğrulanamadı.')
                            if not any(f['kind']==kind for f in child['attachments']):
                                saved=await asyncio.to_thread(store_pdf,raw,owner=self.owner,identity=row['identity'],
                                    record_id=child['recordId'],kind=kind,access_token=self.access_token)
                                if kind=='sgk_service':
                                    from sgk_employee_count import service_employee_count
                                    saved['employeeCount']=service_employee_count(raw)
                                child['attachments'].append(saved)
                        for f in child['attachments']:
                            if f['kind']=='sgk_service':
                                self.remember_employee_count(row['identity'],child['recordId'],f)
                                update=self.employee_count_updates.get((row['identity'],child['recordId']))
                                if update:child['metadata'].update(employeeCount=update['employeeCount'],employeeCountSource=update)
                        warnings=child.get('documentWarnings',[])
                        child['documentStatus']=('partial' if child['attachments'] else 'unavailable') if warnings else 'saved' if child['attachments'] else 'unavailable'
                        for warning in warnings:
                            if not warning.get('sourceUnavailable'):
                                self.failures.append(dict(identity=row['identity'],recordId=child['recordId'],module='sgk',message=warning['message']))
                except (SessionBudgetExceeded, SourceBlockedError):raise
                except Exception as exc:
                    row['sgkRecords']=[]
                    row['sgkSyncStatus']='failed'
                    message=str(exc) if isinstance(exc,ValueError) else 'SGK belge indirme tamamlanamadı ('+type(exc).__name__+').'
                    self.failures.append(dict(identity=row['identity'],recordId=row['recordId'],message=message,module='sgk'))
                    self.failures[-1].update(code=getattr(exc,'code',type(exc).__name__),httpStatus=getattr(exc,'status',None))
        return rows
