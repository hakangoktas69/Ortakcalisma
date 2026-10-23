"""Müşavir oturumundaki kurum menülerini gözler; belge veya veri satırı açmaz.

Kaydedilen tanı yalnızca sabit menü adları, kaynak kökeni ve tablo başlıklarıdır.
Bu çıktı aktarım sonucu değildir; yetki veya tam liste kanıtı sayılmaz.
"""
from urllib.parse import urlsplit
import asyncio
import re
from types import SimpleNamespace
import json
import calendar
_LIVE_QUERY_ALIASES={}
from pathlib import Path


async def select_legacy_calendar_date(frame,prefix,year,month,day):
    """Canlıda doğrulanan takvim düğmeleri; kilitli alanları değiştirmez."""
    trigger=frame.locator('input[name="'+prefix+'TarihiBtn"]')
    if await trigger.count()!=1:return False
    # Önce açık takvimi normal kapatma düğmesiyle kapat, hedef takvimi aç.
    month_field=frame.locator('#dpMonth')
    if await month_field.count()==1 and await month_field.is_visible():
        close=frame.locator('input[type=button][value="X"]')
        if await close.count()!=1:return False
        await close.click(timeout=10000)
    await trigger.click(timeout=10000)
    months=('Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık')
    for _ in range(1200):
        current=await month_field.input_value()
        if current not in months:return False
        current_year=await frame.locator('#dpYear').input_value()
        if not current_year.isdigit():return False
        current_month=months.index(current)+1
        if (int(current_year),current_month)==(year,month):break
        action='increaseMonth()' if (int(current_year),current_month)<(year,month) else 'decreaseMonth()'
        arrow=frame.locator('input[type=button][onclick="'+action+'"]')
        if await arrow.count()!=1:return False
        await arrow.click(timeout=10000)
        if (await frame.locator('#dpYear').input_value(),await month_field.input_value())==(current_year,current):return False
    if await frame.locator('#dpYear').input_value()!=str(year) or await month_field.input_value()!=months[month-1]:return False
    targets=[]
    for candidate in await frame.locator('input[type=button][onclick="setDate(this)"]').all():
        if await candidate.is_visible() and (await candidate.input_value()).strip()==str(day).zfill(2):
            targets.append(candidate)
    if len(targets)!=1:return False
    await targets[0].click(timeout=10000)
    for suffix,value in (('Gun',day),('Ay',month),('Yil',year)):
        if int(await frame.locator('input[name="'+prefix+'Tarihi'+suffix+'"]').input_value())!=value:
            return False
    return True


async def declaration_pilot_query(page,visited,config_override=None):
    """Açıkça etkinleştirilen pilot için yalnızca Beyanname Ara sorgusu."""
    bulk_folder=getattr(page,'_eworks_bulk_folder',None)
    if bulk_folder and (bulk_folder/'finish-current-chunk').exists():
        page._eworks_pilot_stage='chunk_finished'
        await page.close()
        return 'pilot_chunk_finished'
    config_path=Path(__file__).resolve().parent.parent/'Eworks-Portal'/'robot-config.json'
    config=config_override if config_override is not None else ({} if getattr(page,'_eworks_live_sync',False) else json.loads(config_path.read_text(encoding='utf-8-sig')).get('declarationPilot'))
    if not isinstance(config,dict) or config.get('enabled') is not True:
        return None
    tax=config.get('taxNumber','');year=config.get('year')
    upload_month=config.get('uploadMonth')
    query_attempt=config.get('queryAttempt',1)
    if type(query_attempt) is not int or query_attempt not in (1,2):
        raise ValueError('Pilot sorgu deneme sınırı geçersiz.')
    if not re.fullmatch(r'\d{10,11}',tax) or type(year) is not int or not 2004<=year<=2100:
        raise ValueError('Pilot sorgu kapsamı geçersiz.')
    if upload_month is not None and (type(upload_month) is not int or not 1<=upload_month<=12):
        raise ValueError('Pilot yükleme ayı geçersiz.')
    query_signature=(tax,year,upload_month,config.get('startDate'),config.get('endDate'),config.get('periodStart'),config.get('periodEnd'))
    key=(id(page),'declaration_pilot_query',*query_signature,query_attempt)
    if safe_origin(page.url)!='https://ebeyanname.gib.gov.tr':return None
    previous_scope=getattr(page,'_eworks_pilot_scope',None)
    if previous_scope and (previous_scope.get('uploadMonth')!=upload_month or previous_scope.get('identity')!=tax or previous_scope.get('querySignature')!=query_signature):
        for frame in page.frames:
            if safe_origin(frame.url)!='https://ebeyanname.gib.gov.tr':continue
            for heading in await frame.get_by_text('Beyanname Listesi',exact=True).all():
                if not await heading.is_visible():continue
                window=heading.locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," dialog ")][1]')
                if await window.count()!=1:continue
                window_id=await window.get_attribute('id') or ''
                if not re.fullmatch(r'bynList\d+',window_id):continue
                close=window.locator('.alphacube_close')
                if await close.count()==1 and await close.get_attribute('id')==window_id+'_close':
                    if await close.get_attribute('onclick')=='Windows.close("'+window_id+'", event)':
                        page._eworks_pilot_stage='close_previous_result'
                        page._eworks_pilot_close=await close.evaluate('''el=>{
                            const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                            return {width:r.width,height:r.height,hitTag:hit?.tagName,hitId:hit?.id,hitClass:hit?.className};
                        }''')
                        await close.click(timeout=3000)
                        return 'pilot_previous_result_closed'
    matches=[]
    for frame in page.frames:
        if safe_origin(frame.url)!='https://ebeyanname.gib.gov.tr':continue
        field=frame.locator('input[name="vergiNo"]')
        if await field.count()==1 and await field.is_visible():matches.append(frame)
    if len(matches)!=1:return None
    frame=matches[0]
    # Başarısız bir gün seçiminden kalan takvim, form kontrollerini örtebilir.
    active_calendar=frame.locator('#dpMonth')
    if await active_calendar.count()==1 and await active_calendar.is_visible():
        close_calendar=frame.locator('input[type=button][value="X"]')
        if await close_calendar.count()!=1:raise ValueError('Açık tarih seçici kapatma kontrolü tekil değil.')
        await close_calendar.click(timeout=10000)
    calendar_field=config.get('calendarField')
    calendar_key=(id(page),'pilot_calendar',calendar_field)
    if calendar_field in ('start','end') and calendar_key not in visited:
        name='baslangicTarihiBtn' if calendar_field=='start' else 'bitisTarihiBtn'
        visited.add(calendar_key)
        await frame.locator('input[name="'+name+'"]').click(timeout=3000)
        return 'pilot_calendar_opened'
    if key in visited:return None
    use_tc=len(tax)==11
    field=frame.locator('input[name="'+('tcKimlikNo' if use_tc else 'vergiNo')+'"]')
    if await field.count()!=1:raise ValueError('Kimlik sorgu alanı tekil değil.')
    caption=await field.evaluate("el=>(el.closest('td')?.previousElementSibling?.innerText||'').trim()")
    if caption not in (('TC Kimlik Numarası','TC Kimlik Numaras�') if use_tc else ('Vergi Kimlik Numarası',)):raise ValueError('VKN/TCKN alanı doğrulanamadı.')
    button=frame.locator('input[name="sorgulaButon"]')
    if await button.count()!=1 or await button.input_value()!='Sorgula':return None
    # VKN, vergilendirme dönemi ve zorunlu gönderim tarihi; durum/tür/dairesi filtresi yok.
    for suffix in ('N','T','B','P','V','Z','D'):
        control=frame.locator('input[name="sorguTipi'+suffix+'"]')
        if await control.count()!=1:return None
    page._eworks_pilot_stage='tax_filter'
    await frame.locator('input[name="sorguTipiN"]').set_checked(not use_tc)
    await frame.locator('input[name="sorguTipiT"]').set_checked(use_tc)
    page._eworks_pilot_stage='tax_field'
    await field.fill(tax)
    page._eworks_pilot_stage='period_filter'
    use_period=bool(config.get('periodStart')) or not config.get('uploadYearOnly',False)
    await frame.locator('input[name="sorguTipiP"]').set_checked(use_period)
    for suffix in ('B','V','D'):
        page._eworks_pilot_stage='clear_'+suffix
        await frame.locator('input[name="sorguTipi'+suffix+'"]').uncheck()
    page._eworks_pilot_stage='period_filter'
    await frame.locator('input[name="sorguTipiP"]').set_checked(use_period)
    # Canlı form sorguTipiZ'yi onclick="return false" ile zorunlu kılıyor.
    # Gönderim tarihini de pilot yılın tamamına sınırla.
    start_month=upload_month or 1
    end_month=upload_month or 12
    end_day=calendar.monthrange(year,end_month)[1]
    from datetime import date
    start_date=date.fromisoformat(config.get('startDate',f'{year}-{start_month:02d}-01'))
    end_date=date.fromisoformat(config.get('endDate',f'{year}-{end_month:02d}-{end_day:02d}'))
    if not start_date<=end_date or start_date.year!=year or end_date.year!=year:raise ValueError('Sorgu tarih sınırları geçersiz.')
    for prefix,chosen_date in (('baslangic',start_date),('bitis',end_date)):
        month,day=chosen_date.month,chosen_date.day
        values=[await frame.locator('input[name="'+prefix+'Tarihi'+suffix+'"]').input_value()
                for suffix in ('Gun','Ay','Yil')]
        if [int(v) for v in values]!=[day,month,year]:
            if not await select_legacy_calendar_date(frame,prefix,year,month,day):
                return 'pilot_date_picker_required'
    for name,value in (('baslangicTarihiGun',str(start_date.day)),('baslangicTarihiAy',str(start_date.month)),
                       ('baslangicTarihiYil',str(year)),('bitisTarihiGun',str(end_date.day)),
                       ('bitisTarihiAy',str(end_date.month)),('bitisTarihiYil',str(year))):
        page._eworks_pilot_stage=name
        date_field=frame.locator('input[name="'+name+'"]')
        if not await date_field.is_enabled():
            if (await date_field.input_value()).strip().lstrip('0')!=value.lstrip('0'):
                return 'pilot_date_picker_required'
        else:
            await date_field.fill(value,timeout=2000)
    period_first=config.get('periodStart',f'{year}-01');period_last=config.get('periodEnd',f'{year}-12')
    month_names=('ocak','şubat','mart','nisan','mayıs','haziran','temmuz','ağustos','eylül','ekim','kasım','aralık')
    first_month=int(period_first[-2:]);last_month=int(period_last[-2:])
    period_fields=() if not use_period else (('donemBasAy',(month_names[first_month-1],str(first_month),f'{first_month:02d}')),('donemBitAy',(month_names[last_month-1],str(last_month),f'{last_month:02d}')),('donemBasYil',(period_first[:4],)),('donemBitYil',(period_last[:4],)))
    for name,labels in period_fields:
        select=frame.locator('select[name="'+name+'"]')
        page._eworks_pilot_stage=name
        options=await select.locator('option').evaluate_all('els=>els.map(el=>({label:el.textContent.trim(),value:el.value}))')
        choices=[item for item in options if item['label'].lower() in labels]
        if len(choices)!=1:raise ValueError('Pilot dönem seçeneği doğrulanamadı.')
        await select.select_option(value=choices[0]['value'])
    if await field.input_value()!=tax:raise ValueError('Pilot VKN eşleşmedi.')
    visited.add(key) # Hata veya gecikmede sorguyu tekrar gönderme.
    previous_handler=getattr(page,'_eworks_pilot_dialog_handler',None)
    if previous_handler is not None:
        page.remove_listener('dialog',previous_handler)
    async def send_query():
        remaining=1.5-(asyncio.get_running_loop().time()-getattr(page,'_eworks_last_query_sent',0))
        if remaining>0:await asyncio.sleep(remaining)
        page._eworks_last_query_sent=asyncio.get_running_loop().time()
        await button.click(timeout=10000)
    retry_used=False
    async def query_dialog(dialog):
        nonlocal retry_used
        # Sunucunun uyarısını kaybetme; onay/gönderim diyaloğunu kabul etme.
        message=re.sub(r'\d{6,}|[A-Za-z0-9_-]{28,}','[redacted]',dialog.message)
        observed={'type':dialog.type,'message':message[:500]}
        retry=(dialog.type=='alert' and message.strip()=='Hata: Site geçersiz bir cevap döndü. Lütfen çağrı merkezine haber veriniz.' and query_attempt==1 and not retry_used)
        page._eworks_pilot_dialog=None if retry else observed
        history=getattr(page,'_eworks_pilot_history',[])
        history.append({'year':year,'uploadMonth':upload_month,'dialog':observed})
        page._eworks_pilot_history=history
        await dialog.dismiss()
        if retry:
            retry_used=True;config['queryAttempt']=2
            await asyncio.sleep(2.2)
            alternatives=[v for v in _LIVE_QUERY_ALIASES.get(tax,[]) if v!=tax and re.fullmatch(r'\d{10,11}',v)]
            if len(alternatives)==1:
                alternate=alternatives[0];alternate_tc=len(alternate)==11
                alternate_field=frame.locator('input[name="'+('tcKimlikNo' if alternate_tc else 'vergiNo')+'"]')
                if await alternate_field.count()!=1:
                    page._eworks_pilot_dialog=observed;return
                await frame.locator('input[name="sorguTipiN"]').set_checked(not alternate_tc)
                await frame.locator('input[name="sorguTipiT"]').set_checked(alternate_tc)
                await alternate_field.fill(alternate)
                page._eworks_pilot_scope['observedQueryIdentity']=alternatives[0]
            page.once('dialog',query_dialog)
            try:await send_query()
            except Exception:page._eworks_pilot_dialog=observed
    page.once('dialog',query_dialog)
    page._eworks_pilot_dialog_handler=query_dialog
    page._eworks_pilot_dialog=None
    page._eworks_pilot_stage='query_attempted'
    page._eworks_pilot_scope={'year':year,'uploadMonth':upload_month,'identity':tax,'querySignature':query_signature}
    await send_query()
    return 'pilot_declaration_query_submitted'

MENU_LABELS = {
    'notices': ('E-Tebligat', 'e-Tebligat', 'E-Tebligat İşlemleri', 'e-Tebligat İşlemleri'),
    'declarations': ('E-Beyanname', 'e-Beyanname', 'Verilmiş Beyannameler', 'Verilen Beyannameler'),
    'ledgers': ('E-Defter', 'e-Defter', 'e-Defter Uygulaması'),
}

# Resmî uygulama sitelerinden 19.10.2026'da gözlenen girişler.
APPLICATION_ENTRIES = {
    'declarations': ('https://ebeyan.gib.gov.tr/', 'dijitalLogo'),
    'ledgers': ('https://edefter.gib.gov.tr/', 'e-Defter Logo ile Giriş Yap'),
}


async def application_card_target(page,label):
    from navigation_adapter import visible_target, AmbiguousTarget
    if safe_origin(page.url)!='https://dijital.gib.gov.tr':
        return None
    matches=[]
    for candidate in await page.get_by_text(label,exact=True).all():
        if not await candidate.is_visible():
            continue
        is_card=await candidate.evaluate('''el => {
            if(!['P','SPAN','DIV'].includes(el.tagName))return false;
            let r=el.getBoundingClientRect(),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right);
            for(let p=el.parentElement;p;p=p.parentElement){
                if(p.getAttribute('aria-hidden')==='true')return false;
                const style=getComputedStyle(p),box=p.getBoundingClientRect();
                if(/hidden|clip|auto|scroll/.test(style.overflowX)){left=Math.max(left,box.left);right=Math.min(right,box.right);}
            }
            if(right<=left)return false;
            for(let p=el.parentElement,depth=0;p && depth<8;p=p.parentElement,depth++){
                if(p.tagName==='BODY')break;
                if((p.innerText||'').includes('Geçiş Yapılabilecek Uygulamalar'))return true;
            }
            return false;
        }''')
        if is_card: matches.append(candidate)
    if len(matches)>1:
        raise AmbiguousTarget('Birden fazla kurum uygulama kartı bulundu.')
    if matches:return matches[0]
    return await visible_target(SimpleNamespace(pages=[page]),label)


async def application_card_diagnostics(page,label):
    observations=[]
    if safe_origin(page.url)!='https://dijital.gib.gov.tr':
        return observations
    for candidate in await page.get_by_text(label,exact=True).all():
        if not await candidate.is_visible():continue
        observations.append(await candidate.evaluate('''el => {
            const r=el.getBoundingClientRect();
            const parents=[];
            for(let p=el.parentElement,depth=0;p && depth<5;p=p.parentElement,depth++){
                parents.push({tag:p.tagName,cssClass:typeof p.className==='string'?p.className.slice(0,200):'',ariaHidden:p.getAttribute('aria-hidden')});
            }
            return {tag:el.tagName,cursor:getComputedStyle(el).cursor,horizontalInViewport:r.right>0 && r.left<innerWidth,parents};
        }'''))
    return observations[:10]


async def institution_navigation_step(context,visited):
    """Geliştirme oturumunda yalnızca gözlenen e-Beyan kartı/liste menüsü.

    Giriş, belge, beyanname numarası, gönderme veya onay eylemi içermez.
    """
    config=json.loads((Path(__file__).resolve().parent.parent/'Eworks-Portal'/'robot-config.json').read_text(encoding='utf-8-sig'))
    if config.get('moduleInspection')=='notices' and config.get('noticeSourcePreference')=='legacy':
        from navigation_adapter import visible_target,confirm_ivd_transition
        for login_page in context.pages:
            if safe_origin(login_page.url)!='https://dijital.gib.gov.tr':continue
            key=(id(login_page),'notice_manual_login_focused')
            passwords=login_page.locator('input[type=password]')
            if key not in visited and await passwords.count()==1 and await passwords.is_visible():
                visited.add(key)
                await login_page.bring_to_front()
                return 'notice_manual_login_required'
        if config.get('noticeOpenLegacyHome'):
            attempt=config.get('noticeLegacyHomeAttempt',1)
            request_key=('notice_legacy_home_requested',attempt)
            confirm_key=('notice_legacy_home_confirmed',attempt)
            if request_key not in visited:
                home=await visible_target(context,'İnternet Vergi Dairesi')
                if home is not None:
                    visited.add(request_key)
                    await home.click(timeout=5000)
                    return 'notice_legacy_home_requested'
            if confirm_key not in visited and await confirm_ivd_transition(context):
                visited.add(confirm_key)
                return 'notice_legacy_home_confirmed'
        legacy=SimpleNamespace(pages=[p for p in context.pages if safe_origin(p.url)=='https://intvrg.gib.gov.tr'])
        if config.get('noticeLegacyFollowHomeLink') and 'notice_legacy_home_link' not in visited:
            target=await visible_target(legacy,'Ana Sayfaya Git')
            if target is not None:
                visited.add('notice_legacy_home_link')
                await target.click(timeout=5000)
                return 'notice_legacy_home_link'
        for label in MENU_LABELS['notices']:
            key=('legacy_notice_menu',label)
            if key in visited:continue
            target=await visible_target(legacy,label)
            if target is not None:
                visited.add(key)
                await target.click(timeout=5000)
                return 'legacy_notice_menu_opened'
        label=config.get('noticeLegacyMenu')
        if label in ('Özel İşlemler','Mesajlar') and ('legacy_notice_submenu',label) not in visited:
            target=await visible_target(legacy,label)
            if target is not None:
                visited.add(('legacy_notice_submenu',label))
                await target.click(timeout=5000)
                return 'legacy_notice_submenu_opened'
    if config.get('moduleInspection')=='notices':
        if config.get('noticeReturnToList'):
            for page in context.pages:
                if safe_origin(page.url)!='https://dijital.gib.gov.tr':continue
                key=(id(page),'notice_returned_to_list')
                if key in visited:continue
                control=page.locator('a').filter(has_text=re.compile(r'^e-Tebligat\s*\d*$'))
                if await control.count()==1 and await control.is_visible():
                    visited.add(key)
                    await control.click(timeout=5000)
                    return 'notice_returned_to_list'
        for page in context.pages:
            if safe_origin(page.url)!='https://dijital.gib.gov.tr':continue
            key=(id(page),'notice_inspection_focused')
            if key in visited:continue
            columns=page.get_by_text('Gönderen Kurum',exact=True)
            numbers=page.get_by_text('Belge No',exact=True)
            if (any([await c.is_visible() for c in await columns.all()])
                    and any([await c.is_visible() for c in await numbers.all()])):
                await page.bring_to_front()
                visited.add(key)
                return 'notice_inspection_focused'
        if config.get('noticeInspectUserManagement'):
            for page in context.pages:
                if safe_origin(page.url)!='https://dijital.gib.gov.tr':continue
                key=(id(page),'notice_user_management_opened')
                if key in visited:continue
                control=page.get_by_role('link',name='Kullanıcı Yönetimi',exact=True)
                if await control.count()==1 and await control.is_visible():
                    visited.add(key)
                    await control.click(timeout=5000)
                    page._eworks_notice_management_opened=True
                    return 'notice_user_management_opened'
    for page in context.pages:
        module=getattr(page,'_eworks_institution_module',None)
        origin=safe_origin(page.url)
        if module=='declarations' and origin=='https://dijital.gib.gov.tr':
            confirm_key=(id(page),'beyan_transition_confirmation')
            if confirm_key not in visited:
                for heading in await page.get_by_text('Yönlendirmeyi Onaylıyor Musunuz?',exact=True).all():
                    if not await heading.is_visible():continue
                    panel=heading.locator('xpath=ancestor::*[not(self::body) and not(self::html)][.//button[normalize-space(.)="ONAYLA"]][1]')
                    if await panel.count()!=1:continue
                    text=' '.join((await panel.inner_text()).split())
                    expected=('e-Beyanname uygulamasına geçiş yapmak üzeresiniz.',
                        'aktif e-Beyanname oturumlarınız da sonlandırılacaktır.',
                        'Devam etmek istiyor musunuz?')
                    button=panel.get_by_role('button',name='ONAYLA',exact=True)
                    cancel=panel.get_by_role('button',name='İPTAL ET',exact=True)
                    if (all(part in text for part in expected) and await button.count()==1
                            and await cancel.count()==1 and await button.is_enabled()):
                        visited.add(confirm_key)
                        # Kart zaten açıldı; onaydan sonra tekrar tıklamak yeni
                        # bir yönlendirme uyarısı ve ikinci oturum oluşturur.
                        visited.add((id(page),'application_card'))
                        page._eworks_application_card_opened=True
                        await button.click(timeout=5000)
                        return 'e-Beyanname yönlendirme onayı'
            key=(id(page),'application_card')
            if key not in visited and not getattr(page,'_eworks_application_card_opened',False):
                try:
                    target=await asyncio.wait_for(application_card_target(page,'e-Beyanname'),timeout=2)
                except Exception as exc:
                    return 'application_card_'+type(exc).__name__
                if target is not None:
                    visited.add(key)
                    page._eworks_application_card_opened=True
                    await target.click(timeout=5000)
                    return 'e-Beyanname uygulama kartı'
        if origin in ('https://ebeyan.gib.gov.tr','https://ebeyanname.gib.gov.tr'):
            if origin=='https://ebeyanname.gib.gov.tr':
                try:
                    query_state=await declaration_pilot_query(page,visited)
                except Exception as exc:
                    return 'pilot_query_'+getattr(page,'_eworks_pilot_stage','validation')+'_'+type(exc).__name__
                if query_state:return query_state
            # Eski e-Beyanname uygulamasında kullanıcı ekranında doğrulanan
            # liste menüsü. Paket gönderme/onay eylemleri kapsam dışıdır.
            labels=('Beyanname Ara',) if origin=='https://ebeyanname.gib.gov.tr' else ('Beyannameler','Hızlı Menü')
            for label in labels:
                key=(id(page),label)
                if key in visited:
                    continue
                from navigation_adapter import visible_target
                target=await visible_target(SimpleNamespace(pages=[page]),label)
                if target is not None:
                    visited.add(key)
                    await target.click(timeout=5000)
                    return label
    return None


def safe_origin(url):
    try:
        parsed = urlsplit(url)
        host = parsed.hostname or ''
        if (parsed.scheme != 'https' or parsed.username or parsed.password
                or parsed.port not in (None, 443)
                or not (host == 'gib.gov.tr' or host.endswith('.gib.gov.tr')
                        or host == 'edefter.gov.tr' or host.endswith('.edefter.gov.tr'))):
            return None
        return 'https://' + host
    except ValueError:
        return None


async def inspect_navigation(context):
    """Yalnızca görünen menü varlığını bildirir; gezinmez ve belge açmaz."""
    observations = []
    for page in context.pages:
        if not safe_origin(page.url):
            continue
        for frame in page.frames:
            origin = safe_origin(frame.url)
            if not origin:
                continue
            for module, labels in MENU_LABELS.items():
                matched = []
                for label in labels:
                    candidates = frame.get_by_text(label, exact=True)
                    for candidate in await candidates.all():
                        if await candidate.is_visible():
                            matched.append(label)
                            break
                if matched:
                    observations.append(dict(module=module, sourceOrigin=origin,
                                             visibleMenuLabels=matched,
                                             state='navigation_observed', imported=False))
    return observations


async def observe_context_structure(context):
    """Açık kurum sayfalarının yalnızca başlık/menü yapısı; satır/içerik yok."""
    frames=[]
    unobserved_pages=[]
    for page in context.pages:
        if not safe_origin(page.url):
            parsed=urlsplit(page.url)
            unobserved_pages.append(dict(scheme=parsed.scheme,host=parsed.hostname))
            continue
        for frame in page.frames:
            origin=safe_origin(frame.url)
            if not origin:
                continue
            from institution_scope import observe_readonly_account_identity
            account_scope=await observe_readonly_account_identity(frame)
            tables=[]
            for table in await frame.locator('table,[role=grid],[role=table]').all():
                if await table.is_visible():
                    headers=await table.locator('thead th,[role=columnheader]').all_inner_texts()
                    if headers:
                        tables.append([' '.join(h.split())[:160] for h in headers[:40]])
                    elif origin=='https://ebeyanname.gib.gov.tr':
                        legacy=await table.evaluate('''table=>{
                            const row=table.rows?.[0];if(!row)return [];
                            const cells=Array.from(row.cells).map(c=>(c.innerText||'').replace(/\\s+/g,' ').trim());
                            return cells.length>=3 && cells.every(c=>c.length<=100&&!/\\d/.test(c))
                                && cells.some(c=>/beyanname|vergi|durum/i.test(c))?cells:[];
                        }''')
                        if legacy:tables.append(legacy)
            controls=set(await frame.locator('a,button,[role=menuitem],label').evaluate_all('''elements => elements.filter(el => el.getClientRects().length && getComputedStyle(el).visibility!=='hidden')
                .map(el => (el.innerText||'').replace(/\\s+/g,' ').trim())
                .filter(text => text.length>0 && text.length<=100 && !/\\d/.test(text) && /tebligat|beyanname|defter|berat|mükellef|vergi kimlik|hızlı menü/i.test(text))'''))
            transitions=[]
            flags=[]
            from institution_login import application_access_failure
            access_failure=await application_access_failure(frame)
            if access_failure:flags.append(access_failure)
            legacy_controls=await frame.locator('input[type=button],input[type=submit],input[type=image],a img').evaluate_all('''elements => elements.filter(el => el.getClientRects().length && getComputedStyle(el).visibility!=='hidden')
                .map(el => (el.getAttribute('alt')||el.getAttribute('title')||(el.type==='button'||el.type==='submit'?el.value:'')||'').replace(/\\s+/g,' ').trim())
                .filter(text => text.length>0 && text.length<=100 && !/\\d/.test(text))''')
            for flag,label in (
                ('backend_404','default backend - 404'),
                ('signature_agent_unavailable','İmzalama aracına bağlantı kurulamadı!'),
                ('forbidden','Forbidden'),('unauthorized','Unauthorized'),
                ('bad_request','Bad Request')):
                matches=frame.get_by_text(label,exact=True)
                if any([await item.is_visible() for item in await matches.all()]):
                    flags.append(flag)
            for title in await frame.get_by_text('Yönlendirmeyi Onaylıyor Musunuz?',exact=True).all():
                if await title.is_visible():
                    panel=title.locator('xpath=ancestor::*[not(self::body) and not(self::html)][.//button[normalize-space(.)="ONAYLA"]][1]')
                    if await panel.count()==1:
                        text=' '.join((await panel.inner_text()).split())
                        if len(text)<=1200:
                            transitions.append(text)
            card_diagnostics=[]
            form_structure=[]
            calendar_structure=[]
            declaration_list=[]
            declaration_pagination=[]
            declaration_messages=[]
            login_diagnostics=None
            notice_structure=None
            if origin=='https://dijital.gib.gov.tr':
                notice_structure=await frame.locator('table,[role=grid],[role=table]').evaluate_all('''tables=>tables.flatMap(table=>{
                    if(!table.getClientRects().length||getComputedStyle(table).visibility==='hidden')return [];
                    const headers=Array.from(table.querySelectorAll('thead th,[role=columnheader]')).map(el=>(el.innerText||'').replace(/\\s+/g,' ').trim());
                    if(headers.length!==8||headers[1]!=='Gönderen Kurum'||headers[4]!=='Belge No')return [];
                    return [{headers,ariaRowCount:table.getAttribute('aria-rowcount'),visibleRowContainers:Array.from(table.querySelectorAll('tbody tr,[role=row]')).filter(row=>row.getClientRects().length&&!row.querySelector('[role=columnheader]')).length}];
                })''')
                if notice_structure:
                    scope_controls=[]
                    for label in ('Mükellef Değiştir','Mükellef Seçimi','Mükellef Seç','Hesap Değiştir','Temsil Ettiklerim','Yetkili Olduğum Mükellefler','Profilim','Kullanıcı Bilgilerim'):
                        if any([await c.is_visible() for c in await frame.get_by_text(label,exact=True).all()]):scope_controls.append(label)
                    selections=await frame.locator('select,[role=combobox]').evaluate_all('''els=>els.filter(el=>el.getClientRects().length)
                        .map(el=>({tag:el.tagName,label:(el.getAttribute('aria-label')||Array.from(el.labels||[]).map(l=>l.innerText).join(' ')).slice(0,120),
                            optionCount:el.tagName==='SELECT'?el.options.length:null}))''')
                    menu_controls=await frame.locator('button,a,[role=button],[role=menuitem],[aria-haspopup],[tabindex="0"]').evaluate_all('''els=>els
                        .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[role=grid],table,[role=table]'))
                        .map(el=>({tag:el.tagName,label:(el.getAttribute('aria-label')||el.getAttribute('title')||el.innerText||'').trim()
                            .replace(/\\d{10,11}/g,'[redacted]').slice(0,100),hasPopup:el.getAttribute('aria-haspopup')||'',expanded:el.getAttribute('aria-expanded')})).slice(0,65)''')
                    from institution_scope import notice_account_scope
                    target_config=json.loads((Path(__file__).resolve().parent.parent/'Eworks-Portal'/'robot-config.json').read_text(encoding='utf-8-sig'))
                    target=target_config.get('noticeTargetIdentity')
                    notice_structure=dict(tables=notice_structure,scopeControls=scope_controls,selections=selections,menuControls=menu_controls,
                        targetScope=notice_account_scope(account_scope,target,access_mode='advisor') if isinstance(target,str) and re.fullmatch(r'\d{10,11}',target) else None,imported=False)
            ledger_structure=None
            if origin=='https://authebelge.gib.gov.tr':
                ledger_structure=await frame.locator('body').evaluate('''el=>({
                    title:document.title.slice(0,120),visibleTextLength:(el.innerText||'').trim().length,
                    childElementCount:el.childElementCount,
                    headings:Array.from(el.querySelectorAll('h1,h2,h3,[role=alert]'))
                        .filter(n=>n.getClientRects().length).map(n=>(n.innerText||'').trim().replace(/\\d{6,}|[A-Za-z0-9_-]{28,}/g,'[redacted]').slice(0,200)).slice(0,10),
                    controls:Array.from(el.querySelectorAll('input,select,button,a'))
                        .filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden')
                        .map(n=>({tag:n.tagName,type:n.type||'',name:n.getAttribute('name')||'',
                            label:(n.type==='password'?'':n.getAttribute('aria-label')||n.getAttribute('placeholder')||((n.tagName==='BUTTON'||n.tagName==='A')?n.innerText:'')||'').trim().slice(0,100)})).slice(0,30)
                })''')
            if origin=='https://dijital.gib.gov.tr' and urlsplit(frame.url).path.rstrip('/') in ('/portal/login','/portal/oauth'):
                login_diagnostics=await frame.locator('input').evaluate_all('''els=>els
                    .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
                    .map(el=>({type:el.type,disabled:el.disabled,hasValue:!!el.value}))''')
            interface_messages=await frame.locator('body *').evaluate_all('''els=>els
                .filter(el=>!el.children.length&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
                .map(el=>(el.innerText||'').replace(/\\s+/g,' ').trim())
                .filter(text=>text.length>0&&text.length<=300&&/hatalı|hata oluş|yanlış|geçersiz|bağlantı kurulamadı|yetkiniz|oturum.*son|tekrar giriş/i.test(text))
                .map(text=>text.replace(/\\d{6,}|[A-Za-z0-9_-]{28,}/g,'[redacted]')).slice(0,10)''')
            declaration_read=None
            declaration_read_error=None
            if origin=='https://ebeyanname.gib.gov.tr':
                declaration_messages=await frame.locator('body *').evaluate_all('''els=>els
                    .filter(el=>!el.children.length&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
                    .map(el=>(el.innerText||'').replace(/\\s+/g,' ').trim())
                    .filter(text=>text.length>0&&text.length<=300&&/hata|lütfen|bekley|bulunama|oturum|yetki|zaman aş/i.test(text)).slice(0,10)''')
                pilot_config=json.loads((Path(__file__).resolve().parent.parent/'Eworks-Portal'/'robot-config.json').read_text(encoding='utf-8-sig')).get('declarationPilot',{})
                scope=getattr(page,'_eworks_pilot_scope',None)
                if pilot_config.get('enabled') is True and scope:
                    from declaration_reader import read_declaration_page
                    try:
                        declaration_read=await read_declaration_page(frame,identity=pilot_config['taxNumber'],
                            year=scope['year'],upload_month=scope['uploadMonth'])
                        if declaration_read is not None:
                            results=getattr(page,'_eworks_declaration_results',{})
                            results[str(scope['uploadMonth'])]=declaration_read
                            page._eworks_declaration_results=results
                    except ValueError as exc:
                        declaration_read_error=str(exc)
                declaration_list=await frame.locator('table').evaluate_all('''(tables,tax)=>tables.flatMap(table=>{
                    if(!table.getClientRects().length||getComputedStyle(table).visibility==='hidden')return [];
                    const rows=Array.from(table.rows||[]);if(!rows.length)return [];
                    const headers=Array.from(rows[0].cells).map(c=>(c.innerText||'').replace(/\\s+/g,' ').trim());
                    if(headers.length!==10||headers[1]!=='Beyanname Türü'||headers[2]!=='TC Kimlik Numarası / Vergi Kimlik Numarası')return [];
                    const data=rows.slice(1).filter(r=>r.cells.length===10);
                    return [{headers,rowCount:data.length,identityMatches:data.map(r=>(r.cells[2].innerText||'').replace(/\\D/g,'')===tax),
                        sample:data.slice(0,3).map(r=>({document:r.cells[1].innerText.trim(),period:r.cells[5].innerText.trim(),
                            uploadedAt:r.cells[7].innerText.trim(),taxStatus:r.cells[8].innerText.trim(),sgkStatus:r.cells[9].innerText.trim(),
                            controls:Array.from(r.querySelectorAll('a,input,button')).map(el=>({tag:el.tagName,type:el.type||'',text:el.tagName==='A'?el.innerText.trim():'',name:el.getAttribute('name')||''}))}))}];
                })''',pilot_config.get('taxNumber',''))
                declaration_pagination=await frame.locator('input,img').evaluate_all('''els=>els
                    .filter(el=>['İlk Sayfa','Önceki Sayfa','Sonraki Sayfa','Son Sayfa'].includes(el.title||el.alt||el.value))
                    .map(el=>({caption:el.title||el.alt||el.value,tag:el.tagName,disabled:!!el.disabled,
                        parentTag:el.parentElement.tagName,rowText:(el.closest('tr')?.innerText||'').trim().slice(0,180)}))''')
                calendar_structure=await frame.locator('#dpYear,#dpMonth,input[type=button][id^=d]').evaluate_all('''elements=>elements
                    .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
                    .map(el=>({id:el.id,value:el.value,onClick:el.getAttribute('onclick')||'',
                        parent:el.id==='dpYear'||el.id==='dpMonth'?el.closest('tr').outerHTML.slice(0,2500):''}))''')
                # Alan değerlerini ve seçim içeriklerini almadan sorgu formunu tanı.
                form_structure=await frame.locator('input,select,label').evaluate_all('''elements => elements
                    .filter(el=>el.getClientRects().length && getComputedStyle(el).visibility!=='hidden')
                    .map(el=>({tag:el.tagName,type:el.type||'',name:el.getAttribute('name')||'',
                        id:el.id||'',label:el.tagName==='LABEL'?(el.innerText||'').trim().slice(0,100):'',
                        optionCount:el.tagName==='SELECT'?el.options.length:0,
                        checked:el.type==='checkbox'?el.checked:null,disabled:!!el.disabled,
                        datePart:/^(baslangic|bitis)Tarihi(Gun|Ay|Yil)$/.test(el.name)?el.value:null,
                        caption:(el.closest('td')?.previousElementSibling?.innerText||'').trim().slice(0,150),
                        adjacentText:[el.previousSibling,el.nextSibling].filter(n=>n&&n.nodeType===3)
                            .map(n=>n.textContent.trim()).join(' ').slice(0,100)}))''')
            if getattr(page,'_eworks_institution_module',None)=='declarations':
                card_diagnostics=await application_card_diagnostics(page,'e-Beyanname')
            management_structure=None
            if origin=='https://dijital.gib.gov.tr' and getattr(page,'_eworks_notice_management_opened',False):
                management_structure=await frame.locator('a,button,[role=menuitem],h1,h2,h3,[role=columnheader]').evaluate_all('''els=>els
                    .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('[role=row]:not(:has([role=columnheader])),tbody'))
                    .map(el=>({tag:el.tagName,label:(el.getAttribute('aria-label')||el.innerText||'').trim().replace(/\\d{10,11}/g,'[redacted]').slice(0,150)})).filter(el=>el.label).slice(0,80)''')
                target_config=json.loads((Path(__file__).resolve().parent.parent/'Eworks-Portal'/'robot-config.json').read_text(encoding='utf-8-sig'))
                management_rows=await frame.locator('[role=grid]').evaluate_all('''(grids,target)=>grids.filter(g=>g.getClientRects().length).map(g=>{
                    const headers=Array.from(g.querySelectorAll('[role=columnheader]')).map(e=>(e.innerText||'').trim());
                    if(!headers.some(h=>h==='Kullanıcı Tipi')||!headers.some(h=>h==='Vergi Kimlik Numarası'))return null;
                    const rows=Array.from(g.querySelectorAll('[role=row]')).filter(r=>!r.querySelector('[role=columnheader]'));
                    return {visibleRowCount:rows.length,targetIdentityMatches:rows.map(r=>Array.from(r.querySelectorAll('[role=gridcell]')).slice(0,2).some(c=>(c.innerText||'').replace(/\\D/g,'')===target))};
                }).filter(Boolean)''',target_config.get('noticeTargetIdentity',''))
                management_structure=dict(controls=management_structure,rows=management_rows)
                management_structure['navigation']=await frame.locator('nav,aside,[role=navigation],[role=menu],.MuiDrawer-paper').evaluate_all('''els=>els.filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
                    .map(el=>(el.innerText||'').trim().replace(/\\d{10,11}/g,'[redacted]').slice(0,3000))''')
            legacy_navigation=None
            if origin=='https://intvrg.gib.gov.tr':
                legacy_navigation=await frame.locator('a,button,input[type=button],[role=menuitem]').evaluate_all('''els=>els
                    .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
                    .map(el=>({tag:el.tagName,label:(el.getAttribute('aria-label')||el.getAttribute('title')||el.innerText||el.value||'').trim().replace(/\\d{10,11}/g,'[redacted]').slice(0,150)})).filter(e=>e.label).slice(0,90)''')
                legacy_navigation=list({json.dumps(c,ensure_ascii=False):c for c in legacy_navigation}.values())
                legacy_images=await frame.locator('img,input[type=image]').evaluate_all('''els=>els.filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>({tag:el.tagName,id:el.id,alt:el.getAttribute('alt')||'',title:el.getAttribute('title')||'',parentTag:el.parentElement.tagName,parentTitle:el.parentElement.getAttribute('title')||'',clickable:!!el.closest('a,[onclick],[role=button]')})).slice(0,30)''')
                legacy_navigation=dict(controls=legacy_navigation,images=legacy_images,frameName=frame.name)
                if any(c['label']=='Ana Sayfaya Git' for c in legacy_navigation['controls']):
                    legacy_navigation['interfaceText']=await frame.locator('body').evaluate("el=>(el.innerText||'').trim().replace(/\\d{10,11}/g,'[redacted]').slice(0,1200)")
                if not legacy_navigation['controls']:
                    legacy_navigation['menuText']=await frame.locator('body').evaluate('''el=>(el.innerText||'').split(/\\n/).map(s=>s.trim()).filter(s=>s.length>0&&s.length<150&&!/\\d/.test(s)&&/tebligat|beyanname|mükellef|sorgulama|mesaj/i.test(s)).slice(0,45)''')
            frames.append(dict(sourceOrigin=origin,tables=tables[:20],managementStructure=management_structure,legacyNavigation=legacy_navigation,
                               relatedControls=sorted(controls)[:50],transitions=transitions,
                               interfaceFlags=flags,applicationCardDiagnostics=card_diagnostics,
                               interfaceMessages=interface_messages,loginDiagnostics=login_diagnostics,
                               accountScope=account_scope,
                               noticeStructure=notice_structure,
                               ledgerStructure=ledger_structure,
                               actionCaptions=legacy_controls[:40],
                               formStructure=form_structure[:40],
                               pilotStage=getattr(page,'_eworks_pilot_stage',None),
                               pilotDialog=getattr(page,'_eworks_pilot_dialog',None),
                               pilotScope=getattr(page,'_eworks_pilot_scope',None),
                               pilotClose=getattr(page,'_eworks_pilot_close',None),
                               pilotQueries=getattr(page,'_eworks_pilot_history',[]),
                               calendarStructure=calendar_structure[:40],
                               declarationList=declaration_list,
                               declarationPagination=declaration_pagination,
                               declarationMessages=declaration_messages,
                               declarationRead=declaration_read,
                               declarationReadError=declaration_read_error,
                               declarationResults=getattr(page,'_eworks_declaration_results',{}),
                               visibleTableCount=await frame.locator('table').count()))
    return dict(schema='eworks.gib.structure.v1',frames=frames,unobservedPages=unobserved_pages,imported=False)


async def inspect_module_screen(context, module, credentials_provider=None, preferred_page=None, *, keep_open=False):
    """Tekil, gözlenmiş kurum menüsünü açar; yalnızca TH başlıklarını okur.

    Satır, bağlantı adresi, belge, hesap adı veya giriş alanı değerlerini okumaz.
    Birden fazla hedef varsa seçim yapmaz. Menü görünürlüğü yetki kanıtı değildir.
    """
    from navigation_adapter import visible_target
    if module not in MENU_LABELS:
        raise ValueError('Bilinmeyen kurum modülü.')
    config=json.loads((Path(__file__).resolve().parent.parent/'Eworks-Portal'/'robot-config.json').read_text(encoding='utf-8-sig'))
    source_scope=context
    legacy_notice=module=='notices' and config.get('noticeSourcePreference')=='legacy'
    if legacy_notice:
        source_scope=SimpleNamespace(pages=[p for p in context.pages if safe_origin(p.url)=='https://intvrg.gib.gov.tr'])
    observed = await inspect_navigation(source_scope)
    labels = {label for item in observed if item['module']==module
              for label in item['visibleMenuLabels']}
    target = None
    chosen = None
    for label in MENU_LABELS[module]:
        if label not in labels:
            continue
        scope=source_scope if legacy_notice else SimpleNamespace(pages=[preferred_page]) if preferred_page is not None else context
        candidate = await visible_target(scope, label)
        if candidate is not None:
            # Harf büyüklüğü varyantları aynı hedefe eşleşebilir; ilk tekil hedef.
            target, chosen = candidate, label
            break
    result = dict(module=module, state='menu_unavailable', imported=False,
                  tables=[], visibleMenuLabels=[])
    created_app_page=False
    if target is None:
        if module not in APPLICATION_ENTRIES:
            return result
        app_url,button_name=APPLICATION_ENTRIES[module]
        target_page=await context.new_page()
        target_page._eworks_live_sync=getattr(context,'_eworks_live_sync',False)
        target_page._eworks_institution_module=module
        created_app_page=True
        await target_page.goto(app_url,wait_until='domcontentloaded',timeout=20000)
        if not safe_origin(target_page.url):
            result['state']='untrusted_redirect'
            return result
        entry=target_page.get_by_role('button',name=button_name,exact=True)
        for _ in range(5):
            if await entry.count()==1 and await entry.is_visible():
                await entry.click(timeout=5000)
                break
            await asyncio.sleep(1)
        chosen='official_application_entry'
    else:
        target_page = target.page
    original_url = target_page.url
    if created_app_page and credentials_provider is not None:
        from institution_login import complete_application_login
        await asyncio.sleep(1)
        result['loginState']=await complete_application_login(target_page,module,credentials_provider)
        if module=='declarations':
            # Gözlenen yönlendirme girişten sonra DVD ana sayfasına dönebiliyor.
            # Sadece bu uygulamanın sayfasındaki tekil e-Beyanname kartını izle.
            await asyncio.sleep(2)
            follow=await application_card_target(target_page,'e-Beyanname')
            if follow is not None:
                await follow.click(timeout=5000)
                target_page._eworks_application_card_opened=True
                result['followedApplicationMenu']='e-Beyanname'
    original_pages = list(context.pages)
    # Başka sekmelerdeki sözleşme tabloları kurum listesi sayılamaz.
    async def headers_on(page):
        tables=[]
        if not safe_origin(page.url):
            return tables
        for frame in page.frames:
            origin=safe_origin(frame.url)
            if not origin:
                continue
            for table in await frame.locator('table,[role=grid],[role=table]').all():
                if not await table.is_visible():
                    continue
                headers=await table.locator('thead th,[role=columnheader]').all_inner_texts()
                headers=[' '.join(text.split())[:160] for text in headers[:40]]
                if headers:
                    tables.append(dict(sourceOrigin=origin,headers=headers))
        return tables
    baseline=[] if created_app_page else await headers_on(target_page)
    if target is not None:
        await target.click(timeout=5000)
    result['state']='navigation_pending'
    result['openedMenuLabel']=chosen
    # SSO/SPA geçişine sınırlı süre tanı; gövde veya veri satırları okunmaz.
    archive_opened=False
    navigation_visited=set()
    for attempt in range(8):
        await asyncio.sleep(1)
        if module=='declarations':
            module_pages=[p for p in context.pages if p is target_page or p not in original_pages]
            result['navigationState']=await institution_navigation_step(
                SimpleNamespace(pages=module_pages),navigation_visited)
        tables=[]
        controls=set()
        sources=set()
        for page in context.pages:
            if page is not target_page and page in original_pages:
                continue
            if not safe_origin(page.url):
                continue
            sources.add(safe_origin(page.url))
            for table in await headers_on(page):
                if page is not target_page or table not in baseline:
                    if table not in tables:
                        tables.append(table)
            for frame in page.frames:
                if not safe_origin(frame.url):
                    continue
                for control in await frame.locator('a,button,[role=menuitem]').all():
                    if not await control.is_visible():
                        continue
                    label=' '.join((await control.inner_text()).split())
                    if (0<len(label)<=80 and not re.search(r'\d',label)
                            and re.search(r'tebligat|beyanname|defter|berat',label,re.I)):
                        controls.add(label)
        result['tables']=tables[:20]
        result['relatedControls']=sorted(controls)[:40]
        result['sourceOrigins']=sorted(sources)
        source=urlsplit(target_page.url)
        if (source.hostname=='dijital.gib.gov.tr'
                and source.path.rstrip('/') in ('/portal/login','/portal/oauth')
                and await target_page.locator('input[type=password]').count()):
            result['state']='reauthentication_required'
        if tables:
            result['state']='new_table_headers_observed'
        # Canlıda görülen bu eylem bir liste bağlantısıdır; belge satırı değildir.
        if (attempt==3 and not tables and module=='notices'
                and 'ARŞİVLENEN TEBLİGATLAR' in controls):
            archive=await visible_target(context,'ARŞİVLENEN TEBLİGATLAR')
            if archive is not None:
                await archive.click(timeout=5000)
                archive_opened=True
                result['openedListLabel']='ARŞİVLENEN TEBLİGATLAR'
        if attempt>=3 and not archive_opened:
            break
    result['visibleMenuLabels']=await inspect_navigation(context)
    # Bir sonraki modülü önceki modülün alt sayfasında arama.
    # Yalnızca tarayıcının gerçek geçmişini kullan; URL türetme/SSO üretme yok.
    if not keep_open and not created_app_page and target_page.url!=original_url:
        await target_page.go_back(wait_until='domcontentloaded',timeout=10000)
        if archive_opened and target_page.url!=original_url:
            await target_page.go_back(wait_until='domcontentloaded',timeout=10000)
        result['returnedToStart']=target_page.url==original_url
        await asyncio.sleep(2)
    return result
