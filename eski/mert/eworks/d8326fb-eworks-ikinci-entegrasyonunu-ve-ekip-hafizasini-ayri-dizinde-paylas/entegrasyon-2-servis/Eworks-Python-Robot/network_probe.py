"""Tek sorguluk bağlantı testi; belge indirme veya portal veri aktarımı yapmaz."""
import asyncio
from datetime import date,timedelta
from urllib.parse import urlsplit
from cloud_credentials import fill_gib_credentials
from captcha_assist import CaptchaAssist
from institution_discovery import inspect_module_screen,institution_navigation_step
from declaration_reader import HEADERS
from local_files import atomic_json


async def probe(context,page,credentials,report,folder,*,verify_service=False):
    context._eworks_live_sync=True
    assists={};filled=set();opened=False;visited=set();app=None
    fill_attempts={}
    deadline=asyncio.get_running_loop().time()+240
    while asyncio.get_running_loop().time()<deadline:
        if (folder/'cancel').exists():raise ValueError('Bağlantı testi iptal edildi.')
        for candidate in context.pages:
            candidate._eworks_live_sync=True
            parsed=urlsplit(candidate.url)
            if parsed.scheme!='https':continue
            if parsed.hostname=='dijital.gib.gov.tr' and parsed.path.rstrip('/')=='/portal/login':
                # Sadece hazır olma durumunu kaydet; alan değerleri ve kimlikler kaydedilmez.
                controls=await candidate.locator('input,button').evaluate_all('''els => els.filter(e=>e.getClientRects().length).map(e=>({
                    tag:e.tagName,type:e.type||'',enabled:!e.disabled,
                    populated:e.tagName==='INPUT'&&!!e.value,
                    loginButton:e.tagName==='BUTTON'&&/^\\s*giriş\\s+yap\\s*$/i.test(e.innerText)
                }))''')
                atomic_json(folder/'login-readiness.json',{'controls':controls,'credentialsAvailable':bool(credentials)})
                assist=assists.setdefault(id(candidate),CaptchaAssist(auto_login=True))
                password_controls=[c for c in controls if c['type']=='password']
                reset=(id(candidate) in filled and len(password_controls)==1 and not password_controls[0]['populated'])
                if credentials and (id(candidate) not in filled or reset) and assist.submitted_at is None and fill_attempts.get(id(candidate),0)<2:
                    # React başlangıç yüklemesi alanları yeniden oluşturursa tek kez yeniden doldur.
                    # Kaynak sözlüğü giriş doğrulanana/deadline'a kadar yalnız bellekte tut.
                    if await fill_gib_credentials(candidate,dict(credentials)):
                        filled.add(id(candidate))
                        fill_attempts[id(candidate)]=fill_attempts.get(id(candidate),0)+1
                        atomic_json(folder/'login-fill.json',{'attempts':fill_attempts[id(candidate)],'filled':True})
                msg=await assist.suggest(candidate)
                if msg:report(folder,'awaiting_user',msg)
            elif parsed.hostname=='dijital.gib.gov.tr' and parsed.path.rstrip('/')=='/portal' and not opened:
                report(folder,'running','GİB bağlantısı doğrulandı; e-Beyanname geçişi test ediliyor.')
                opened=True
                try:
                    await asyncio.wait_for(inspect_module_screen(context,'declarations',None,preferred_page=candidate,keep_open=True),timeout=45)
                except asyncio.TimeoutError:
                    report(folder,'running','GİB uygulama geçişi bekleniyor; henüz sorgu gönderilmedi.')
            elif parsed.hostname=='ebeyanname.gib.gov.tr':
                app=candidate;app._eworks_live_sync=True
        if app:
            state=[]
            for frame in app.frames:
                p=urlsplit(frame.url)
                if p.scheme=='https' and p.hostname=='ebeyanname.gib.gov.tr':
                    form=frame.locator('input[name="sorgulaButon"]')
                    state.append({'queryControls':await form.count(),
                        'queryVisible':await form.count()==1 and await form.is_visible(),
                        'searchMenuControls':await frame.get_by_text('Beyanname Ara',exact=True).count()})
                    if await form.count()==1 and await form.is_visible():
                        return await query_once(frame,folder,report,verify_service=verify_service)
            atomic_json(folder/'connection-readiness.json',{'declarationFrames':state})
        try:await asyncio.wait_for(institution_navigation_step(context,visited),timeout=10)
        except asyncio.TimeoutError:
            report(folder,'running','GİB menüsü bekleniyor; sorgu henüz gönderilmedi.')
        await asyncio.sleep(.5)
    raise ValueError('Bağlantı testinde GİB giriş veya sorgu ekranı tamamlanamadı. Mevcut kayıtlar korunuyor.')


async def query_once(frame,folder,report,*,verify_service=False):
    p=urlsplit(frame.url)
    if p.scheme!='https' or p.hostname!='ebeyanname.gib.gov.tr' or p.port not in (None,443):
        raise ValueError('Test sorgusunun kaynak kökeni doğrulanamadı.')
    # Kaynağın kendi varsayılan tarihini kullan; başka kapsam üretme.
    values={}
    for prefix in ('baslangic','bitis'):
        parts=[]
        for suffix in ('Yil','Ay','Gun'):
            control=frame.locator('input[name="'+prefix+'Tarihi'+suffix+'"]')
            if await control.count()!=1:raise ValueError('Test tarih alanları doğrulanamadı.')
            parts.append(int(await control.input_value()))
        values[prefix]=date(*parts)
    if not timedelta(0)<=values['bitis']-values['baslangic']<=timedelta(days=7):
        raise ValueError('Bağlantı testi en fazla 7 günlük varsayılan tarih aralığıyla sınırlıdır.')
    for name in ('sorguTipiN','sorguTipiT','sorguTipiB','sorguTipiP','sorguTipiV','sorguTipiD'):
        field=frame.locator('input[name="'+name+'"]')
        if await field.count()!=1 or await field.is_checked():raise ValueError('Test kapsamına ek filtre seçilmiş; sorgu çalıştırılmadı.')
    if not await frame.locator('input[name="sorguTipiZ"]').is_checked():raise ValueError('Test yükleme tarihi filtresi doğrulanamadı.')
    button=frame.locator('input[name="sorgulaButon"]')
    if await button.get_attribute('onclick')!='taxReturnSearchFormPost()':raise ValueError('Salt okunur sorgu kontrolü doğrulanamadı.')
    dialog_kind=[]
    async def dialog_handler(dialog):
        dialog_kind.append(dialog.type)
        # Hiçbir teyit kabul edilmez; ham mesaj diske yazılmaz.
        await dialog.dismiss()
    frame.page.on('dialog',dialog_handler)
    service=None
    if verify_service:
        from declaration_service import DeclarationService
        service=DeclarationService(frame.page.context,values['baslangic'],values['bitis'])
        frame.page.context.on('request',service.capture)
    try:
        report(folder,'running','Tek salt okunur sorgu çalışıyor; belge indirilmeyecek ve kayıt eklenmeyecek.')
        await button.click(timeout=10000)
        for _ in range(90):
            if (folder/'cancel').exists():raise ValueError('Bağlantı testi iptal edildi.')
            if dialog_kind:raise ValueError('GİB bağlantı testinde uyarı verdi; sonuç boş kabul edilmedi.')
            tables=await frame.locator('table').evaluate_all('''(tables,headers)=>tables.filter(t=>{
                if(!t.getClientRects().length||!t.rows.length)return false;
                return JSON.stringify(Array.from(t.rows[0].cells).map(c=>c.innerText.replace(/\\s+/g,' ').trim()))===JSON.stringify(headers);
            }).map(t=>({count:t.rows.length-1}))''',HEADERS)
            controls=await frame.locator('input[title="Sonraki Sayfa"]').all()
            visible=[c for c in controls if await c.is_visible()]
            if len(tables)==1 and len(visible)==1:
                import re
                paging=await visible[0].evaluate("el=>({text:el.closest('tr').innerText.trim(),disabled:el.disabled})")
                counts=re.fullmatch(r'\s*(\d+)\s*-\s*(\d+)\s*/\s*(\d+)\s*',paging['text'])
                if not counts or int(counts[1])!=1 or int(counts[2])!=tables[0]['count'] or int(counts[3])<tables[0]['count']:
                    raise ValueError('Test sonuç sayfalaması doğrulanamadı.')
                summary=dict(startDate=values['baslangic'].isoformat(),endDate=values['bitis'].isoformat(),
                    visibleRows=tables[0]['count'],totalRows=int(counts[3]),hasMorePages=not paging['disabled'],queryCount=1)
                if service is not None:
                    browser_rows=await frame.locator('table').evaluate_all('''(tables,headers)=>tables.filter(t=>t.getClientRects().length&&t.rows.length&&JSON.stringify(Array.from(t.rows[0].cells).map(c=>c.innerText.replace(/\\s+/g,' ').trim()))===JSON.stringify(headers)).flatMap(t=>Array.from(t.rows).slice(1).map(r=>({id:r.id,cells:Array.from(r.cells).map(c=>c.innerText.replace(/\\s+/g,' ').trim())})))''',HEADERS)
                    report(folder,'running','İkinci entegrasyon aynı sorguyu servis üzerinden okuyor; sonuçlar karşılaştırılıyor.')
                    atomic_json(folder/'service-template-status.json',{'captured':service.payload is not None,'valid':not service.error})
                    result=await service.query()
                    from declaration_service import compare_records
                    differences=[{'row':i,'idMatch':a['id']==b['id'],
                        'columns':[j for j,(x,y) in enumerate(zip(a['cells'],b['cells'])) if x!=y]}
                        for i,(a,b) in enumerate(zip(browser_rows,result['records'])) if a!=b]
                    import re
                    def status_label(text):
                        # Sadece durum sütunu; kimlik, satır referansı veya URL yazılmaz.
                        text=re.sub(r'https?://\S+|[A-Za-z0-9_%=-]{25,}|\d+','[redacted]',text)
                        return text[:120]
                    status_samples=list({(status_label(a['cells'][8]),status_label(b['cells'][8])) for a,b in zip(browser_rows,result['records']) if a['cells'][8]!=b['cells'][8]})
                    atomic_json(folder/'service-comparison.json',{'browserRows':len(browser_rows),'serviceRows':len(result['records']),'differences':differences,'statusSamples':status_samples})
                    if (not compare_records(browser_rows,result['records']) or result['totalRows']!=summary['totalRows']
                            or result['hasMorePages']!=summary['hasMorePages']):
                        raise ValueError('Servis ve tarayıcı sonuçları eşleşmedi; aktarım etkinleştirilmedi.')
                    summary.update(serviceVerified=True,serviceQueryCount=1,serviceRows=len(result['records']),transport='same_session_http')
                    atomic_json(folder/'service-verification.json',summary)
                return summary
            await asyncio.sleep(.5)
        raise ValueError('Tek sorgunun sonucu bekleme süresi içinde doğrulanamadı.')
    finally:
        frame.page.remove_listener('dialog',dialog_handler)
        if service is not None:
            frame.page.context.remove_listener('request',service.capture)
            service.close()
