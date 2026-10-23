"""Yerel HTML ve GIB XLS -> JSON dosya aktarimi. GIB'e baglanmaz."""
from pathlib import Path
import sys, json, time, threading, shutil, subprocess, secrets, uuid, re, importlib.util
from datetime import datetime
from zoneinfo import ZoneInfo
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parent
TOKEN=secrets.token_urlsafe(32)
JOBS={}
LOCK=threading.Lock()
sys.path.insert(0,str(ROOT/'runtime'))
import xlrd
sys.path.insert(0,str(ROOT.parent/'Eworks-Python-Robot'))
from cloud_credentials import verify_owner
from declaration_review import load_declaration_review
HEADERS=['Mükellef Vergi Kimlik Numarası','Mükellef TC Kimlik Numarası','Mükellef Unvanı','Mükellef Vergi Dairesi','Sözleşme Numarası','Sözleşme Tarihi','Hizmet Sözleşmesi Tarih ve No','Sisteme Giriş Tarihi','Sözleşme Türü']
FIELDS=['taxNumber','identityNumber','name','taxOffice','number','date','service','registeredAt','type']
def convert(path):
    sheet=xlrd.open_workbook(str(path)).sheet_by_index(0)
    if sheet.row_values(0)!=HEADERS: raise ValueError('GIB sozlesme basliklari eslesmiyor')
    rows=[]; keys=set()
    for i in range(1,sheet.nrows):
        values=[str(v).strip() for v in sheet.row_values(i)]
        if not any(values):continue
        r=dict(zip(FIELDS,values))
        for k,n in [('taxNumber',10),('identityNumber',11)]:
            if r[k]=='-----':r[k]=''
            if r[k] and (not r[k].isdigit() or len(r[k])!=n):raise ValueError('Gecersiz kimlik alani')
        if not r['name'] or not r['number'] or not (r['taxNumber'] or r['identityNumber']):raise ValueError('Eksik kayit')
        key=(r['taxNumber'] or r['identityNumber'],r['number'])
        if key in keys:raise ValueError('Tekrarlanan sozlesme')
        keys.add(key);rows.append(r)
    if not rows:raise ValueError('Bos aktarim uygulanmadi')
    payload={'schema':'eworks.gib.contracts.v1','source':'GİB / Geçerli E-Beyanname Sözleşmeleri Listesi','exportedAt':datetime.fromtimestamp(path.stat().st_mtime,ZoneInfo('Europe/Istanbul')).isoformat(),'count':len(rows),'contracts':rows}
    temp=ROOT/'gib-sozlesmeler.json.tmp'
    temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    temp.replace(ROOT/'gib-sozlesmeler.json')
    if path.resolve()!=(ROOT/'gib-sozlesmeler.xls').resolve():shutil.copy2(path,ROOT/'gib-sozlesmeler.xls')
    print(f'Aktarim tamam: {len(rows)} sozlesme',flush=True)
def robot_config():
    p=ROOT/'robot-config.json'
    if not p.exists():return None
    c=json.loads(p.read_text(encoding='utf-8-sig'))
    if c.get('enabled') is not True:return None
    if c.get('mode')!='python':return None
    if not (ROOT.parent/'Eworks-Python-Robot'/'portal_worker.py').is_file():return None
    if not all(importlib.util.find_spec(n) for n in ('playwright','pytesseract','PIL','supabase','dotenv')):return None
    return c
def run_job(job_id,config,access_token=''):
    folder=ROOT/'jobs'/job_id
    folder.mkdir(parents=True,exist_ok=False)
    with LOCK:owner=JOBS[job_id]['ownerId']
    request={'requestId':job_id,'ownerId':owner}
    if config.get('networkProbe') is True:request['networkProbe']=True
    if config.get('declarationSync'):
        request['declarationSync']=config['declarationSync']
        request['downloadDocuments']=True
        if config.get('documentRetrySourceJobId'):request['documentRetrySourceJobId']=config['documentRetrySourceJobId']
        if config.get('documentScope')=='sgk':request['documentScope']='sgk'
    if config.get('moduleInspection') in ('notices','declarations','ledgers','all','declarations_notices'):
        request['moduleInspection']=config['moduleInspection']
        hold=config.get('inspectionHoldSeconds',0)
        if type(hold) is int and 0<=hold<=600:
            request['inspectionHoldSeconds']=hold
    (folder/'request.json').write_text(json.dumps(request),encoding='utf-8')
    with LOCK:JOBS[job_id].update(state='running',message='Python robotu Chrome penceresini hazırlıyor.')
    try:
        worker=ROOT.parent/'Eworks-Python-Robot'/'portal_worker.py'
        result=subprocess.run([sys.executable,str(worker),str(folder)],cwd=str(worker.parent),input=json.dumps({'accessToken':access_token}).encode('utf-8'),capture_output=True,timeout=7230 if config.get('declarationSync') else 930,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        access_token=''
        status_file=folder/'status.json'
        if result.returncode!=0:
            status=json.loads(status_file.read_text(encoding='utf-8')) if status_file.exists() else {}
            raise RuntimeError(status.get('message','Python GİB robotu tamamlanamadı.'))
        batch=json.loads(result.stdout.decode('utf-8'))
        if batch.get('requestId')!=job_id or batch.get('ownerId')!=owner:raise ValueError('İş kimliği eşleşmiyor')
        if config.get('networkProbe') is True:
            if batch.get('schema')!='eworks.gib.network-probe.v1' or batch.get('queryCount')!=1:raise ValueError('Bağlantı testi sonucu doğrulanamadı.')
            (folder/'network-probe-result.json').write_text(json.dumps(batch,ensure_ascii=False),encoding='utf-8')
            with LOCK:JOBS[job_id].update(state='completed',message='Tek sorguluk GİB bağlantı testi tamamlandı; portal verileri değiştirilmedi.',_result=batch)
            return
        if config.get('declarationSync'):
            if batch.get('schema')!='eworks.declarations.sync.v1' or batch.get('year')!=config['declarationSync']['year'] or batch.get('identities')!=config['declarationSync']['identities']:raise ValueError('Beyanname sonucu kapsamı eşleşmiyor.')
            if 'startDate' in config['declarationSync'] and batch.get('queryScope')!=config['declarationSync']:raise ValueError('Beyanname tarih kapsamı eşleşmiyor.')
            if (folder/'cancel').exists():raise RuntimeError('İş iptal edildi; kayıt uygulanmadı.')
            saved=folder/'declarations-sync-result.tmp'
            saved.write_text(json.dumps(batch,ensure_ascii=False),encoding='utf-8')
            saved.replace(folder/'declarations-sync-result.json')
            with LOCK:JOBS[job_id].update(state='completed',message='Beyanname sorgusu tamamlandı; portal kaydı bekleniyor.',_result=batch)
            return
        # Aynı doğrulama hem okuyucuda hem yerel sunucuda uygulanır.
        robot_folder=str(worker.parent)
        if robot_folder not in sys.path:sys.path.insert(0,robot_folder)
        from gib_automation import validate_contracts
        confirmed=json.loads((folder/'ready.json').read_text(encoding='utf-8'))['expectedCount']
        validate_contracts([dict(r,musavir_id=owner) for r in batch['contracts']],confirmed,owner)
        if batch.get('count')!=confirmed or batch.get('schema')!='eworks.gib.contracts.v1':raise ValueError('Sonuç biçimi geçersiz')
        if (folder/'cancel').exists():raise RuntimeError('İş iptal edildi; kayıt uygulanmadı.')
        count=batch['count']
        with LOCK:JOBS[job_id].update(state='completed',message=f'{count} sözleşme doğrulandı; portalın Supabase kaydı bekleniyor.',count=count,_result=batch)
    except subprocess.TimeoutExpired:
        with LOCK:JOBS[job_id].update(state='failed',message='Robot 15 dakika içinde tamamlanmadı. Önceki veriler korunuyor.')
    except Exception as e:
        with LOCK:JOBS[job_id].update(state='failed',message=str(e) if isinstance(e,RuntimeError) else 'Yeni GİB sonucu doğrulanamadı. Önceki veriler korunuyor.')

def public_job(job_id):
    with LOCK:job=dict(JOBS.get(job_id,{}))
    if job.get('state') in ('queued','running','awaiting_user'):
        p=ROOT/'jobs'/job_id/'status.json'
        try:
            status=json.loads(p.read_text(encoding='utf-8'))
            job.update({k:status[k] for k in ('state','message') if k in status})
        except (OSError,ValueError):pass
    return {k:v for k,v in job.items() if not k.startswith('_')}

def signal_focus(job_id):
    try:
        pid=json.loads((ROOT/'jobs'/job_id/'worker.json').read_text(encoding='utf-8'))['pid']
        if type(pid) is not int or not 0<pid<2**32:return False
        (ROOT/'jobs'/f'focus-{pid}.request').touch()
        return True
    except (OSError,ValueError,KeyError,TypeError):return False

class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript','.wasm':'application/wasm','.bcmap':'application/octet-stream'}
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
    def do_GET(self):
        if self.headers.get('Host') not in ('127.0.0.1:8765','localhost:8765'):
            self.send_error(403);return
        path=self.path.split('?')[0]
        if path=='/api/connection':
            ready=robot_config() is not None
            return self.reply(200,{'token':TOKEN,'ready':ready,'mode':'python','message':'Python robot bağlantısı hazır; GİB oturumu kullanıcı tarafından açılır.' if ready else 'Python robot bağımlılıkları hazır değil.'})
        if path.startswith('/api/jobs/'):
            if self.headers.get('X-Eworks-Token')!=TOKEN:return self.reply(403,{'message':'Geçersiz istek'})
            parts=path.strip('/').split('/')
            job_id=parts[2] if len(parts)>=3 else ''
            job=public_job(job_id)
            if not job:return self.reply(404,{'message':'İş bulunamadı'})
            if self.headers.get('X-Eworks-Owner')!=job['ownerId']:return self.reply(403,{'message':'İş farklı portal oturumuna ait'})
            if len(parts)==4 and parts[3]=='result':
                with LOCK:batch=JOBS[job_id].get('_result')
                return self.reply(200 if batch else 409,batch or {'message':'Sonuç hazır değil'})
            if len(parts)!=3:return self.reply(404,{'message':'İşlem bulunamadı'})
            return self.reply(200,job)
        from urllib.parse import unquote
        vendor=(ROOT/unquote(path).lstrip('/')).resolve()
        vendor_allowed=path.startswith('/vendor/pdfjs/') and vendor.is_relative_to((ROOT/'vendor'/'pdfjs').resolve()) and vendor.is_file()
        if path not in ['/', '/eworks-tasarim.html','/gib-sozlesmeler.json','/demo-cleanup.js','/institution-review.js','/declaration-pdf-viewer.mjs'] and not vendor_allowed:
            self.send_error(404);return
        if self.path=='/':self.path='/eworks-tasarim.html'
        super().do_GET()
    def reply(self,status,payload):
        raw=json.dumps(payload,ensure_ascii=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_POST(self):
        if self.headers.get('Host') not in ('127.0.0.1:8765','localhost:8765') or self.headers.get('Origin') not in ('http://127.0.0.1:8765','http://localhost:8765') or self.headers.get('X-Eworks-Token')!=TOKEN:
            return self.reply(403,{'message':'Geçersiz yerel istek'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=(65536 if self.path=='/api/declarations/sync' else 4096):raise ValueError()
            body=json.loads(self.rfile.read(length))
            owner=str(uuid.UUID(body['ownerId']))
        except (ValueError,KeyError,TypeError):return self.reply(400,{'message':'Geçerli portal kullanıcı kimliği gerekli'})
        match=re.fullmatch(r'/api/jobs/([a-f0-9]{32})/(continue|cancel|focus)',self.path)
        if match:
            job_id,action=match.groups()
            job=public_job(job_id)
            if not job:return self.reply(404,{'message':'İş bulunamadı'})
            if owner!=job['ownerId']:return self.reply(403,{'message':'İş farklı portal oturumuna ait'})
            if job['state'] not in ('queued','running','awaiting_user'):return self.reply(409,{'message':'İş artık devam ettirilemez'})
            folder=ROOT/'jobs'/job_id
            if not folder.is_dir():return self.reply(409,{'message':'Robot hazırlanıyor; kısa süre sonra tekrar deneyin'})
            if action=='focus':
                sent=signal_focus(job_id)
                return self.reply(202,{'message':'Açık GİB penceresi öne getiriliyor.' if sent else 'Chrome hazırlanıyor; kısa süre sonra tekrar deneyin.'})
            if action=='cancel':
                (folder/'cancel').touch()
                return self.reply(202,{'message':'İptal istendi'})
            if job['state']!='awaiting_user':return self.reply(409,{'message':'Robot kullanıcı adımını henüz beklemiyor'})
            count=body.get('expectedCount')
            if type(count) is not int or not 0<count<=100000:return self.reply(400,{'message':'GİB ekranındaki pozitif toplam sözleşme sayısını girin'})
            temporary=folder/'ready.tmp'
            temporary.write_text(json.dumps({'expectedCount':count}),encoding='utf-8')
            temporary.replace(folder/'ready.json')
            return self.reply(202,{'message':'Listeyi okuma isteği alındı'})
        if self.path not in ('/api/gib/update','/api/gib/network-probe','/api/declarations/review','/api/declarations/retry-plan','/api/declarations/sync'):return self.reply(404,{'message':'İşlem bulunamadı'})
        authorization=self.headers.get('Authorization','')
        access_token=authorization[7:] if authorization.startswith('Bearer ') else ''
        if not verify_owner(access_token,owner):return self.reply(401,{'message':'Geçerli Eworks oturumu gerekli; tekrar giriş yapın.'})
        if self.path=='/api/declarations/retry-plan':
            try:
                from document_retry import retry_plan
                configured=json.loads((ROOT/'document-retry-source.json').read_text(encoding='utf-8'))
                plan=retry_plan(ROOT,owner,configured['sourceJobId'])
                return self.reply(200,{k:v for k,v in plan.items() if k!='targets'})
            except (OSError,ValueError,KeyError,TypeError):return self.reply(409,{'message':'Belge hata tekrar planı doğrulanamadı.'})
        if self.path=='/api/declarations/review':
            try:
                from declaration_sync import latest_saved_sync
                saved=latest_saved_sync(ROOT,owner)
                return self.reply(200,saved if saved is not None else load_declaration_review(ROOT,owner))
            except PermissionError:return self.reply(403,{'message':'Kaynak gözlem bu portal hesabına ait değil.'})
            except (OSError,ValueError,KeyError,TypeError):return self.reply(409,{'message':'Gözlem kaynağı doğrulanamadı; mevcut kayıtlar korundu.'})
        config=robot_config()
        if config is None:return self.reply(503,{'state':'setup_required','message':'Python robotu hazır değil; bağımlılıklarını kontrol edin. Mevcut kayıtlar korunuyor.'})
        kind='network_probe' if self.path=='/api/gib/network-probe' else 'declarations' if self.path=='/api/declarations/sync' else 'contracts'
        if kind=='network_probe':
            config={**config,'networkProbe':True}
            config.pop('moduleInspection',None)
            config.pop('declarationSync',None)
        if kind=='declarations':
            from declaration_sync import validate_scope
            try:scope=validate_scope(body.get('scope'))
            except (ValueError,TypeError):return self.reply(400,{'message':'Firma ve gönderim yılı kapsamı geçersiz.'})
            config={**config,'declarationSync':scope}
            if body.get('documentRetrySourceJobId'):
                try:
                    from document_retry import retry_plan
                    plan=retry_plan(ROOT,owner,body['documentRetrySourceJobId'])
                    if plan['scope']!=scope:raise ValueError()
                    config['documentRetrySourceJobId']=plan['sourceJobId']
                except (OSError,ValueError,KeyError,TypeError):return self.reply(400,{'message':'Belge tekrar kapsamı doğrulanamadı.'})
            if body.get('documentScope')=='sgk':config['documentScope']='sgk'
            config.pop('moduleInspection',None)
        with LOCK:
            active=next((j for j in JOBS.values() if j['state'] in ('queued','running','awaiting_user')),None)
            if active:
                if active['ownerId']!=owner:return self.reply(409,{'message':'Başka bir güncelleme çalışıyor.'})
                if active.get('kind','contracts')!=kind or (kind=='declarations' and active.get('scope')!=scope):return self.reply(409,{'message':'Farklı bir GİB sorgusu çalışıyor. Önce tamamlayın veya iptal edin.'})
                signal_focus(active['id'])
                return self.reply(202,{'jobId':active['id'],'state':active['state'],'reused':True,'message':'Mevcut GİB işi devam ediyor; pencere öne getiriliyor.'})
            job_id=uuid.uuid4().hex
            JOBS[job_id]={'id':job_id,'ownerId':owner,'kind':kind,'state':'queued','message':'GİB aktarımı sıraya alındı.'}
            if kind=='declarations':JOBS[job_id]['scope']=scope
        threading.Thread(target=run_job,args=(job_id,config,access_token),daemon=True).start()
        return self.reply(202,{'jobId':job_id,'state':'queued'})
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        super().end_headers()
    def log_message(self,*args):pass
if __name__=='__main__':
    (ROOT/'incoming').mkdir(exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',8765),Handler)
    print('Local: http://127.0.0.1:8765/eworks-tasarim.html',flush=True)
    server.serve_forever()
