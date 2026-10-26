"""Salt okunur, işe özel kapsamla e-Beyanname listelerini tarar."""
import asyncio
import re
import json
from datetime import datetime, timezone, date, timedelta
import calendar
from zoneinfo import ZoneInfo
from institution_discovery import (inspect_module_screen, institution_navigation_step,
    declaration_pilot_query, safe_origin)
from declaration_reader import read_declaration_pages,HEADERS
from advisor_records import normalized
from cloud_credentials import fill_gib_credentials
from local_files import atomic_json


def save_checkpoint(folder,result):
    try:atomic_json(folder/'declarations-sync-checkpoint.json',result)
    except PermissionError:
        # Kilitli hedef yerine yeni adla doğrulanmış ara sonucu koru.
        atomic_json(folder/f'declarations-sync-checkpoint-{result["completedScopes"]:05d}.json',result)


def recover_checkpoint(folder,request,error_type):
    if (folder/'cancel').exists():return None
    paths=sorted(folder.glob('declarations-sync-checkpoint*.json'),key=lambda p:p.stat().st_mtime,reverse=True)
    if not paths:return None
    try:result=json.loads(paths[0].read_text(encoding='utf-8'))
    except (OSError,ValueError):return None
    if (result.get('schema')!='eworks.declarations.sync.v1' or result.get('ownerId')!=request.get('ownerId')
            or result.get('requestId')!=request.get('requestId') or not result.get('batches')
            or result.get('identities')!=request.get('declarationSync',{}).get('identities')):return None
    result['failures'].insert(0,dict(message='Tarama kesildi ('+error_type+'); doğrulanan ara sonuçlar korundu.'))
    return result


def source_failure_streak(previous,dialog):
    """Yalnız gözlenen belirli GİB servis uyarısında seri hatayı sınırlar."""
    return previous+1 if (dialog and dialog.get('type')=='alert' and
        dialog.get('message','').strip()=='Hata: Site geçersiz bir cevap döndü. Lütfen çağrı merkezine haber veriniz.') else 0


def empty_result_dialog(dialog):
    return bool(dialog and dialog.get('type')=='alert' and ' '.join(normalized(dialog.get('message','')).split()) in {
        'hata: sorgu yaptiginiz kriterlere uyan beyanname bulunamamistir.',
        'sorgu yaptiginiz kriterlere uyan beyanname bulunamamistir.'})


def validate_scope(scope):
    now=datetime.now(ZoneInfo('Europe/Istanbul'))
    if not isinstance(scope,dict) or type(scope.get('year')) is not int or not 2004<=scope['year']<=now.year:
        raise ValueError('Geçerli bir gönderim yılı seçin.')
    identities=scope.get('identities')
    if not isinstance(identities,list) or not 1<=len(identities)<=2000 or len(set(identities))!=len(identities) or any(not isinstance(v,str) or not re.fullmatch(r'\d{10,11}',v) for v in identities):
        raise ValueError('Firma kapsamı geçersiz.')
    if 'startDate' not in scope and 'endDate' not in scope:return dict(year=scope['year'],identities=identities)
    try:
        start=date.fromisoformat(scope['startDate']);end=date.fromisoformat(scope['endDate'])
    except (ValueError,KeyError,TypeError):raise ValueError('Geçerli başlangıç ve bitiş tarihi seçin.') from None
    if start.isoformat()!=scope['startDate'] or end.isoformat()!=scope['endDate'] or not date(2004,1,1)<=start<=end<=now.date():
        raise ValueError('Tarih aralığı geçersiz veya gelecekte.')
    mode=scope.get('mode')
    if mode not in ('period','upload'):raise ValueError('Tarih seçimi türü geçersiz.')
    result=dict(year=start.year,identities=identities,mode=mode,startDate=start.isoformat(),endDate=end.isoformat())
    if mode=='period':
        first,last=scope.get('periodStart',''),scope.get('periodEnd','')
        if any(not isinstance(v,str) or not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',v) for v in (first,last)) or not '2004-01'<=first<=last<=now.strftime('%Y-%m'):
            raise ValueError('Vergilendirme dönemi aralığı geçersiz.')
        result.update(periodStart=first,periodEnd=last)
    return result


def query_segments(scope):
    now=datetime.now(ZoneInfo('Europe/Istanbul'))
    start=date.fromisoformat(scope.get('startDate',f'{scope["year"]}-01-01'))
    end=date.fromisoformat(scope.get('endDate',f'{scope["year"]}-{now.month if scope["year"]==now.year else 12:02d}-{calendar.monthrange(scope["year"],now.month if scope["year"]==now.year else 12)[1]:02d}'))
    segments=[];cursor=start
    while cursor<=end:
        last=min(end,date(cursor.year,cursor.month,calendar.monthrange(cursor.year,cursor.month)[1]))
        segments.append(dict(year=cursor.year,month=cursor.month,startDate=cursor.isoformat(),endDate=last.isoformat()))
        cursor=last+timedelta(days=1)
    return segments


async def synchronize(context,folder,request,contracts,credentials_provider,report,document_collector=None,max_run_seconds=6800):
    from integration_errors import SessionBudgetExceeded,SourceBlockedError
    stop_at=asyncio.get_running_loop().time()+min(6800,max_run_seconds)
    guard=getattr(document_collector,'session_guard',None)
    if guard:
        guard.run_deadline=stop_at
        context._eworks_session_guard=guard
    scope=validate_scope(request['declarationSync'])
    segments=query_segments(scope)
    months=sorted({s['month'] for s in segments})
    result=dict(schema='eworks.declarations.sync.v1',requestId=request['requestId'],ownerId=request['ownerId'],
        year=scope['year'],identities=scope['identities'],months=months,batches=[],failures=[],completedScopes=0,
        totalScopes=len(segments)*len(scope['identities']))
    if 'startDate' in scope:result.update(queryScope=scope,segments=segments)
    eligible={};identity_aliases={}
    for identity in scope['identities']:
        matching=[c for c in contracts if identity in (c.get('taxNumber'),c.get('identityNumber'))
            and normalized(c.get('type','')) in {'aracilik ve sorumluluk sozlesmesi','elektronik beyanname aracilik ve sorumluluk sozlesmesi'}
            and c.get('number')]
        numbers=sorted({c['number'] for c in matching})
        if numbers:
            eligible[identity]=numbers
            identity_aliases[identity]=sorted({v for c in matching for v in (c.get('taxNumber'),c.get('identityNumber')) if isinstance(v,str) and re.fullmatch(r'\d{10,11}',v)})
        else:result['failures'].append(dict(identity=identity,message='Canlı geçerli aracılık ve sorumluluk sözleşmesi bulunamadı.'))
    if not eligible:return result
    from bulk_resume import load_resume
    resumed=[] if request.get('documentRetrySourceJobId') else load_resume(folder,request,scope,eligible)
    result['batches'].extend(resumed);result['completedScopes']=len(resumed)
    result['resumedScopes']=len(resumed)
    resumed_keys={(b['accessEvidence']['identity'],b['year'],b['uploadMonths'][0]) for b in resumed}
    if resumed:save_checkpoint(folder,result)
    if max_run_seconds<=0:
        result['failures'].append(dict(message='Portal oturumu yenilenmeli; ara sonuçlar korundu.'))
        result['sessionRenewalRequired']=True
        return result
    from captcha_assist import CaptchaAssist
    captcha_assists={}
    context._eworks_live_sync=True
    for page in context.pages:page._eworks_live_sync=True
    report(folder,'running','e-Beyanname uygulaması açılıyor. Giriş bilgileri ve görsel doğrulama otomatik doldurulacak.')
    await inspect_module_screen(context,'declarations',None,preferred_page=context.pages[0],keep_open=True)
    visited=set();app=None;filled=set()
    deadline=asyncio.get_running_loop().time()+180
    while asyncio.get_running_loop().time()<deadline:
        if (folder/'cancel').exists():raise ValueError('İş iptal edildi.')
        for page in context.pages:
            page._eworks_live_sync=True
            if safe_origin(page.url)=='https://dijital.gib.gov.tr' and id(page) not in filled and '/portal/login' in page.url:
                credentials=await credentials_provider()
                try:
                    if credentials and await fill_gib_credentials(page,credentials):filled.add(id(page))
                finally:credentials.clear()
            if safe_origin(page.url)=='https://dijital.gib.gov.tr' and '/portal/login' in page.url:
                captcha=captcha_assists.setdefault(id(page),CaptchaAssist(auto_login=True))
                message=await captcha.suggest(page)
                if message:report(folder,'awaiting_user',message)
            if safe_origin(page.url)=='https://ebeyanname.gib.gov.tr':
                if any([await f.locator('input[name="vergiNo"]').count() for f in page.frames]):app=page;break
        if app:break
        await institution_navigation_step(context,visited)
        if not any(p for p in context.pages if safe_origin(p.url)=='https://dijital.gib.gov.tr' and '/portal/login' in p.url):report(folder,'awaiting_user','e-Beyanname sorgu ekranı bekleniyor.')
        await asyncio.sleep(1)
    if app is None:raise ValueError('e-Beyanname sorgu ekranına ulaşılamadı. Mevcut kayıtlar korundu.')
    last_query_at=0.0
    consecutive_source_failures=0
    for index,identity in enumerate(scope['identities']):
        if identity not in eligible:continue
        for segment in segments:
            year=segment['year'];month=segment['month']
            if (identity,year,month) in resumed_keys:continue
            if (folder/'finish-current-chunk').exists():
                result['chunkFinished']=True
                return result
            if (folder/'cancel').exists():raise ValueError('İş iptal edildi; sonuç uygulanmadı.')
            if asyncio.get_running_loop().time()>stop_at:
                result['failures'].append(dict(identity=identity,month=month,message='Oturum süresi için ara sonuç kaydedildi; kalan kapsam devam edecek.'))
                result['sessionRenewalRequired']=True
                return result
            report(folder,'running',f'Mükellef {index+1}/{len(scope["identities"])} · {segment["startDate"]} – {segment["endDate"]} · {result["completedScopes"]}/{result["totalScopes"]} sorgu tamamlandı.')
            config=dict(enabled=True,taxNumber=identity,year=year,uploadMonth=month,uploadYearOnly=True)
            if 'startDate' in scope:
                config.update(startDate=segment['startDate'],endDate=segment['endDate'])
                if scope['mode']=='period':config.update(periodStart=scope['periodStart'],periodEnd=scope['periodEnd'])
            transport=getattr(context,'_eworks_service_transport',None)
            if transport:
                transport.begin_scope({**config,'startDate':segment['startDate'],'endDate':segment['endDate']},identity_aliases[identity])
            submitted=False
            try:
                remaining=1.5-(asyncio.get_running_loop().time()-last_query_at)
                if remaining>0:await asyncio.sleep(remaining)
                for _ in range(8):
                    state=await declaration_pilot_query(app,visited,config)
                    if state=='pilot_declaration_query_submitted':
                        last_query_at=asyncio.get_running_loop().time();submitted=True;break
                    if state!='pilot_previous_result_closed':break
                    await asyncio.sleep(.2)
                if not submitted:raise ValueError('Sorgu alanları veya tarih seçimi doğrulanamadı.')
                rows=None;last_read_error=None
                for _ in range(90):
                    await asyncio.sleep(.5)
                    if transport and transport.error:raise transport.failure or ValueError(transport.error)
                    dialog=getattr(app,'_eworks_pilot_dialog',None)
                    if dialog:
                        warning=' '.join(normalized(dialog.get('message','')).split())
                        if (dialog.get('type')=='alert' and warning=='hata: iki istek arasi en az 1 sn olabilir.'
                                and config.get('queryAttempt',1)==1):
                            await asyncio.sleep(1.6)
                            config['queryAttempt']=2
                            retried=await declaration_pilot_query(app,visited,config)
                            last_query_at=asyncio.get_running_loop().time()
                            if retried=='pilot_declaration_query_submitted':continue
                            raise ValueError('GİB hız sınırı sonrası sorgu yeniden başlatılamadı.')
                        # Yalnızca açık bir eşleşme-yok yanıtı boş sonuç sayılır.
                        if empty_result_dialog(dialog):rows=[];break
                        raise ValueError('GİB sorguyu tamamlayamadı; boş sonuç sayılmadı.')
                    for frame in app.frames:
                        if safe_origin(frame.url)!='https://ebeyanname.gib.gov.tr':continue
                        try:
                            rows=await read_declaration_pages(frame,identity=identity,year=year,upload_month=month,
                                upload_range=(segment['startDate'],segment['endDate']) if 'startDate' in scope else None,
                                period_range=(scope['periodStart'],scope['periodEnd']) if scope.get('mode')=='period' else None,
                                identity_aliases=identity_aliases[identity],document_collector=document_collector)
                        except ValueError as exc:
                            # AJAX yanıtı gelene kadar önceki tablo DOM'da kalabilir.
                            # Doğrulanmayan satır hiçbir zaman sonuç olarak uygulanmaz.
                            last_read_error=exc;rows=None
                        if rows is not None:break
                    if rows is not None:break
                if rows is None:raise last_read_error or ValueError('GİB sonucu bekleme süresi doldu.')
                if request.get('documentRetrySourceJobId'):
                    targets=document_collector.retry_targets
                    rows=[r for r in rows if (r['identity'],r['recordId']) in targets]
                batch=dict(schema='eworks.gib.review.v1',ownerId=request['ownerId'],
                    sourceJobId=request['requestId'],sourceOrigin='https://ebeyanname.gib.gov.tr',year=year,
                    uploadYearOnly=True,uploadMonths=[month],reviewState='verified_access',authorizationVerified=True,
                    accessEvidence=dict(method='same_session_contract_and_scoped_query',identity=identity,
                        contractNumbers=eligible[identity],identityAliases=identity_aliases[identity],observedAt=datetime.now(timezone.utc).isoformat()),
                    count=len(rows),records=[dict(row,uploadMonth=month) for row in rows])
                if 'startDate' in scope:batch['queryRange']={**segment,**{k:scope[k] for k in ('mode','periodStart','periodEnd') if k in scope}}
                if request.get('documentRetrySourceJobId'):batch['documentRetrySourceJobId']=request['documentRetrySourceJobId']
                result['batches'].append(batch)
                if transport:result['serviceTransport']=dict(transport.counts,transport='same_session_http')
                result['completedScopes']+=1
                consecutive_source_failures=0
                save_checkpoint(folder,result)
            except (SessionBudgetExceeded,SourceBlockedError) as exc:
                result['failures'].insert(0,dict(identity=identity,month=month,code=exc.code,message=str(exc)))
                result['sessionRenewalRequired']=isinstance(exc,SessionBudgetExceeded) or getattr(exc,'status',None) in (401,403)
                save_checkpoint(folder,result)
                return result
            except Exception as exc:
                import traceback
                failure_detail=dict(identity=identity,month=month,errorType=type(exc).__name__,
                    stage=getattr(app,'_eworks_pilot_stage',None),
                    frames=[dict(file=__import__('pathlib').Path(f.filename).name,function=f.name,line=f.lineno) for f in traceback.extract_tb(exc.__traceback__)])
                # Playwright hata metinlerinde token/kimlik bulunabilir; yalnız yapısal çağrı yeri saklanır.
                error_log=folder/'query-errors.json'
                try:errors=json.loads(error_log.read_text(encoding='utf-8')) if error_log.exists() else []
                except (OSError,ValueError):errors=[]
                errors.append(failure_detail);atomic_json(error_log,errors)
                diagnostics=[]
                for frame in ([] if app.is_closed() else app.frames):
                    if safe_origin(frame.url)!='https://ebeyanname.gib.gov.tr':continue
                    try:
                        summary=await frame.locator('table').evaluate_all('''(tables,arg)=>tables.flatMap(t=>{
                            const rows=Array.from(t.rows||[]);if(!t.getClientRects().length||!rows.length)return [];
                            const headers=Array.from(rows[0].cells).map(c=>(c.innerText||'').replace(/\\s+/g,' ').trim());
                            if(JSON.stringify(headers)!==JSON.stringify(arg.headers))return [];
                            return [{rowCount:rows.length-1,rows:rows.slice(1,11).map(r=>({cells:r.cells.length,
                              idLength:(r.id||'').replace(/^row/,'').length,
                              identityMatches:(r.cells[2]?.innerText||'').replace(/\\D/g,'')===arg.identity,
                              identityDigits:(r.cells[2]?.innerText||'').replace(/\\D/g,'').length,
                              hasXmlReference:/^[A-Za-z0-9_-]+\\.xml(?:\\s|$)/.test(r.title||'')}))}];
                        })''',dict(headers=HEADERS,identity=identity))
                        fields=await frame.locator('input[name="vergiNo"]').evaluate_all('(els,tax)=>els.map(el=>({valueMatches:el.value===tax,disabled:el.disabled}))',identity)
                        diagnostics.append(dict(tables=summary,fields=fields))
                    except Exception:pass
                (folder/'declaration-sync-diagnostics.json').write_text(json.dumps(diagnostics),encoding='utf-8')
                dialog=getattr(app,'_eworks_pilot_dialog',None)
                if dialog:(folder/'declaration-query-warning.json').write_text(json.dumps(dialog,ensure_ascii=False),encoding='utf-8')
                result['failures'].insert(0,dict(identity=identity,month=month,
                    message=str(exc) if isinstance(exc,ValueError) else 'GİB listesi okunamadı ('+type(exc).__name__+'; '+str(failure_detail['stage'])+').'))
                if transport and transport.error:
                    if result['batches']:save_checkpoint(folder,result)
                    report(folder,'running','Servis yanıtı doğrulanamadı; doğrulanan sonuçlar korunarak kalan aktarım durduruldu.')
                    return result
                consecutive_source_failures=source_failure_streak(consecutive_source_failures,dialog)
                if consecutive_source_failures>=8:
                    result['failures'].insert(0,dict(message='GİB art arda 8 sorguda geçersiz cevap uyarısı verdi; doğrulanmış sonuçlar korundu, kalan kapsam sorgulanmadı.'))
                    save_checkpoint(folder,result)
                    report(folder,'running','GİB art arda geçersiz cevap verdi. Doğrulanan ara sonuçlar kaydediliyor; kalan kapsam tamamlanmış sayılmayacak.')
                    return result
                if result['batches']:save_checkpoint(folder,result)
                # Sonraki kapsam yeniden VKN/tarih ve her dönen satırı doğrular.
                # Sorgu formu kaybolduysa yeni hedefe geçiş güvenli değildir.
                forms=[]
                if app.is_closed():
                    alternatives=[page for page in context.pages if not page.is_closed() and safe_origin(page.url)=='https://ebeyanname.gib.gov.tr']
                    if len(alternatives)!=1:return result
                    app=alternatives[0]
                for frame in app.frames:
                    if safe_origin(frame.url)=='https://ebeyanname.gib.gov.tr':
                        forms.extend(await frame.locator('input[name="vergiNo"]').all())
                if not forms or not any([await f.is_visible() for f in forms]):return result
                continue
    return result
def latest_saved_sync(root,owner):
    paths=sorted([*(root/'jobs').glob('*/declarations-sync-result.json'),*(root/'jobs').glob('*/declarations-sync-checkpoint*.json')],key=lambda p:p.stat().st_mtime,reverse=True)
    for path in paths:
        request=json.loads((path.parent/'request.json').read_text(encoding='utf-8'))
        if request.get('ownerId')!=owner:continue
        if (path.parent/'cancel').exists():continue
        if path.name.startswith('declarations-sync-checkpoint'):
            try:status=json.loads((path.parent/'status.json').read_text(encoding='utf-8'))
            except (OSError,ValueError):continue
            if status.get('state')!='failed':continue
            error=re.search(r'\b\w+Error\b',status.get('message',''))
            recovered=recover_checkpoint(path.parent,request,error[0] if error else 'iş kesintisi')
            if recovered is not None:return recovered
            continue
        result=json.loads(path.read_text(encoding='utf-8'))
        if (result.get('ownerId')!=owner or result.get('requestId')!=path.parent.name
            or result.get('schema')!='eworks.declarations.sync.v1'
            or result.get('year')!=request.get('declarationSync',{}).get('year')
            or result.get('identities')!=request.get('declarationSync',{}).get('identities')
            or ('startDate' in request.get('declarationSync',{}) and result.get('queryScope')!=request['declarationSync'])):
            raise ValueError('Son sorgu kaynağı eşleşmiyor.')
        return result
    return None
