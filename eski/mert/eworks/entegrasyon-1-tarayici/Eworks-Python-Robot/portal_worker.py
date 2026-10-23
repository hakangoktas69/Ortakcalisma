"""Portaldan tek iş: görünür Chrome -> doğrulanmış liste -> JSON stdout.

Belge PDF'lerini özel Supabase Storage'a yükler; kayıt bağlantılarını ve
liste sonucunu mevcut portal oturumu atomik kaydeder. Şifre, CAPTCHA,
çerez veya tarayıcı profili diske kaydedilmez. Durum dosyaları kayıt içermez.
"""
import asyncio
import json
import re
import sys
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, Error as BrowserError
from gib_automation import FIELDS, GibSelectors, scrape_contract_table
from cloud_credentials import fetch_credentials, fill_gib_credentials
from captcha_assist import CaptchaAssist
from local_files import atomic_json

HEADERS = (
    'Mükellef Vergi Kimlik Numarası', 'Mükellef TC Kimlik Numarası',
    'Mükellef Unvanı', 'Mükellef Vergi Dairesi', 'Sözleşme Numarası',
    'Sözleşme Tarihi', 'Hizmet Sözleşmesi Tarih ve No',
    'Sisteme Giriş Tarihi', 'Sözleşme Türü',
)
TITLE = 'Geçerli E-Beyanname Sözleşmeleri Listesi'


def normalized(text):
    return ' '.join(text.split()).casefold()


def trusted(url):
    parsed = urlsplit(url)
    host = (parsed.hostname or '').lower()
    return parsed.scheme == 'https' and (host == 'gib.gov.tr' or host.endswith('.gib.gov.tr'))


def report(folder, state, message):
    try:atomic_json(folder/'status.json',dict(state=state,message=message))
    except PermissionError:pass # Son durum kilitli olsa da doğrulanmış sonuçları kaybetme.


class ProgressLogger:
    """Veri veya ham hataları yazmaz; mevcut modülün logger arayüzü."""
    def write_log(self, *args):
        return True


from navigation_adapter import AmbiguousTarget, visible_target, advance_navigation
import navigation_adapter
import importlib


def reload_navigation_if_changed(previous):
    # Yalnızca bu projede yazdığımız yerel adaptör; webden kod indirilmez.
    changed = Path(navigation_adapter.__file__).stat().st_mtime_ns
    if changed != previous:
        importlib.invalidate_caches()
        module = importlib.reload(navigation_adapter)
        globals().update(visible_target=module.visible_target, advance_navigation=module.advance_navigation)
    return changed


def footer_counts(text):
    values = re.findall(r'(\d+)\s*-\s*(\d+)\s+listeleniyor\.?\s*Toplam\s*:\s*(\d+)', text, re.I)
    unique = set(tuple(map(int, value)) for value in values)
    if len(unique) > 1:
        raise ValueError('Birden fazla toplam kayıt sayısı görüldü; liste belirsiz.')
    if not unique:
        return None
    first, last, total = unique.pop()
    if not 1 <= first <= last <= total <= 100000:
        raise ValueError('GİB toplam kayıt bilgisi geçersiz.')
    return first, last, total


async def prepare_list(context, frame, config, *, show_all=True):
    """Tümünü Göster'i açar, toplamı bağımsız alt bilgiden okur."""
    clicked = False
    for _ in range(40):
        totals = footer_counts(await frame.locator('body').inner_text())
        if totals is None:
            return None  # Eski/manual sayı yolu; başarı iddiası yok.
        first, last, total = totals
        table = frame.locator(config.table)
        widths = [await row.locator('td').count() for row in (await table.locator('tr').all())[1:]]
        row_count = sum(width == len(config.headers) for width in widths)
        if first == 1 and last == total and row_count == total:
            return total
        if show_all and not clicked:
            target = await visible_target(context, 'Tümünü Göster')
            if target is not None:
                await target.click(timeout=5000)
                clicked = True
        await asyncio.sleep(0.25)
    raise ValueError(f'Tablo: {row_count} veri satırı; GİB toplamı: {total}. Tümünü Göster adımını Chrome’da elle tamamlayın. Oturum açık tutuluyor; veri yazılmadı.')


async def discover(context):
    """Yalnızca gözlenen başlıkları eşleşen görünür tabloyu tanır."""
    matches = []
    for page in context.pages:
        if not trusted(page.url):
            continue
        for frame in page.frames:
            if not trusted(frame.url):
                continue
            heading = frame.get_by_text(TITLE, exact=True)
            if await heading.count() != 1 or not await heading.is_visible():
                continue
            tables = frame.locator('table')
            for index in range(await tables.count()):
                table = tables.nth(index)
                if not await table.is_visible():
                    continue
                cells = table.locator('tr').first.locator('th,td')
                observed = tuple(t.strip() for t in await cells.all_inner_texts())
                labels = tuple(map(normalized, observed))
                expected = tuple(map(normalized, HEADERS))
                # Kullanıcının canlı ekranında son sütun Görüntüle eylemidir.
                # Veriye katılmaz; başka bilinmeyen sütunlar kabul edilmez.
                if labels not in (expected, expected + ('görüntüle',)):
                    continue
                # Sayfalama hedefi DOM'da gerçekten görülen isimden türetilir.
                controls = frame.locator('a,button,input[type=button],input[type=submit]')
                next_indexes = []
                for n in range(await controls.count()):
                    control = controls.nth(n)
                    if not await control.is_visible():
                        continue
                    labels = [await control.inner_text(), await control.get_attribute('value'),
                              await control.get_attribute('aria-label'), await control.get_attribute('title')]
                    if any(normalized(label or '') in {'sonraki', 'sonraki sayfa', 'ileri', 'next', 'next page'}
                           for label in labels):
                        next_indexes.append(n)
                if len(next_indexes) > 1:
                    raise ValueError('Birden fazla sonraki sayfa düğmesi bulundu; hedef elle doğrulanmalı.')
                next_selector = ('a,button,input[type=button],input[type=submit] >> nth=' + str(next_indexes[0])) if next_indexes else ''
                config = GibSelectors(
                    username='', password='', captcha_image='', captcha_input='',
                    login_button='', login_success='', list_heading='text="'+TITLE+'"',
                    table=f'table >> nth={index}', headers=observed,
                    columns={field: i for i, field in enumerate(FIELDS)}, next_button=next_selector,
                )
                matches.append((frame, config))
    if len(matches) > 1:
        raise ValueError('Birden fazla sözleşme listesi açık; tek liste bırakın.')
    return matches[0] if matches else None


async def run(folder, access_token=''):
    (folder/'worker.json').write_text(json.dumps({'pid':os.getpid()}),encoding='utf-8')
    request = json.loads((folder / 'request.json').read_text(encoding='utf-8'))
    institution_token=access_token if request.get('moduleInspection') or request.get('declarationSync') else ''
    credentials = await asyncio.to_thread(fetch_credentials, access_token, request['ownerId']) if access_token else {}
    access_token = ''
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=False)
        try:
            context = await browser.new_context()
            context.set_default_timeout(15000)
            page = await context.new_page()
            captcha_assist = CaptchaAssist(auto_login=True)
            await page.goto('https://dijital.gib.gov.tr/portal/login', wait_until='domcontentloaded')
            report(folder, 'awaiting_user', 'Açılan Chrome’da müşavir hesabıyla giriş ve güvenlik kodunu tamamlayın. Robot görünen GİB menülerinden sözleşme listesine ilerlemeyi deneyecek. Menü bulunamazsa listeyi elle açabilirsiniz.')
            ready = folder / 'ready.json'
            visited = set()
            found = None
            navigation_version = Path(navigation_adapter.__file__).stat().st_mtime_ns
            while True:
                if (folder / 'cancel').exists():
                    raise ValueError('İş kullanıcı tarafından iptal edildi.')
                if not context.pages:
                    raise ValueError('Robotun Chrome penceresi kapatıldı.')
                try:
                    navigation_version = reload_navigation_if_changed(navigation_version)
                    await navigation_adapter.focus_requested(context)
                    if credentials and await fill_gib_credentials(page, credentials):
                        report(folder, 'awaiting_user', 'GİB giriş bilgileri dolduruldu. Güvenlik kodu otomatik okunup giriş denenecek. Şifre yerel dosyaya kaydedilmedi.')
                    try:
                        captcha_message = await captcha_assist.suggest(page)
                        if captcha_message:
                            report(folder, 'awaiting_user', captcha_message)
                    except Exception:
                        # OCR yardımcıdır; başarısızlık giriş veya liste okumayı durdurmaz.
                        message = 'Doğrulama otomatik tamamlanamadı. GİB ekranını kontrol edin; kodu elle tamamlayabilirsiniz.' if request.get('declarationSync') else captcha_assist.notice('error', 'OCR/giriş adımı tamamlanamadı. GİB ekranını kontrol edin; otomatik yeniden gönderim yapılmadı.')
                        if message:
                            report(folder, 'awaiting_user', message)
                    found = await discover(context)
                    if found is not None:
                        frame, config = found
                        # Tablo, altındaki kontrol düğmesinden önce görünebilir.
                        # Kontrol henüz yüklenmediyse sonraki tur yeniden arasın.
                        # Tam listede etiket "Sayfalı Göster" olur; tekrar tıklanmaz.
                        total = await prepare_list(context, frame, config, show_all=True)
                        if total is not None:
                            if ready.exists() and json.loads(ready.read_text(encoding='utf-8'))['expectedCount'] != total:
                                raise ValueError('Girilen toplam GİB ekranındaki toplamla eşleşmiyor.')
                            temporary = folder / 'ready.tmp'
                            temporary.write_text(json.dumps({'expectedCount': total, 'source': 'gib_visible_footer'}), encoding='utf-8')
                            temporary.replace(ready)
                        if ready.exists():
                            count = json.loads(ready.read_text(encoding='utf-8'))['expectedCount']
                            report(folder, 'running', 'Sözleşme tablosu bulundu; kayıtlar ve toplam doğrulanıyor.')
                            records = await scrape_contract_table(frame, request['ownerId'], selectors=config,
                                                                 expected_count=count, logger=ProgressLogger())
                            break
                        report(folder, 'awaiting_user', 'Sözleşme tablosu bulundu. Toplam alt bilgisi tanınmadı; GİB toplamını Eworks’e girip Liste hazır düğmesine basın.')
                    else:
                        diagnostics = {}
                        moved = await advance_navigation(context, visited, diagnostics)
                        (folder/'navigation-diagnostics.json').write_text(json.dumps(diagnostics,ensure_ascii=False),encoding='utf-8')
                        if moved:
                            report(folder, 'awaiting_user', 'GİB menüsünde ilerleniyor: '+moved+'. Sözleşme listesi bekleniyor.')
                except ValueError as exc:
                    report(folder, 'awaiting_user', str(exc))
                except BrowserError as exc:
                    # Menü geçişi sırasında değişen belgeyi sonraki turda yeniden gözle.
                    report(folder, 'awaiting_user', 'GİB ekranı okunamadı ('+type(exc).__name__+'). Chrome açık; sözleşme listesini kontrol edin. Veri yazılmadı.')
                await asyncio.sleep(1)
            if (folder / 'cancel').exists():
                raise ValueError('İş kullanıcı tarafından iptal edildi.')
            for record in records:
                record.pop('musavir_id', None)
            if request.get('declarationSync'):
                from declaration_sync import synchronize
                from declaration_documents import DocumentCollector,known_documents
                document_collector=None
                if request.get('downloadDocuments'):
                    known=await asyncio.to_thread(known_documents,request['ownerId'],institution_token)
                    document_collector=DocumentCollector(folder,request['ownerId'],institution_token,report,known=known)
                    await document_collector.load_cached_employee_counts()
                async def sync_credentials():
                    return await asyncio.to_thread(fetch_credentials,institution_token,request['ownerId'])
                try:batch=await synchronize(context,folder,request,records,sync_credentials,report,document_collector=document_collector)
                except BrowserError as exc:
                    from declaration_sync import recover_checkpoint
                    batch=recover_checkpoint(folder,request,type(exc).__name__)
                    if batch is None:raise
                if document_collector is not None:
                    batch['documentFailures']=document_collector.failures
                    batch['employeeCountUpdates']=list(document_collector.employee_count_updates.values())
                sys.stdout.buffer.write(json.dumps(batch,ensure_ascii=False).encode('utf-8'))
                return
            # Kanıt aynı görünür Chrome oturumunda, doğrulanmış canlı listeden
            # üretilir. Kullanıcı adı/şifre veya varsayılan mükellef kimliği yok.
            if request.get('moduleInspection') and institution_token:
                (folder/'advisor-contract-evidence.json').write_text(json.dumps({
                    'schema':'eworks.advisor.contract-evidence.v1',
                    'ownerId':request['ownerId'],'requestId':request['requestId'],
                    'sourceOrigin':'https://intvrg.gib.gov.tr',
                    'observedAt':datetime.now(timezone.utc).isoformat(),
                    'sourceType':'gib_live','contracts':records,
                    'observedCount':len(records)},ensure_ascii=False),encoding='utf-8')
            # Giriş/OCR ve sözleşme okumasından sonra, yalnızca menü varlığı tanısı.
            # Başarısız gözlem geçerli sözleşme sonucunu etkileyemez.
            from institution_discovery import inspect_navigation
            try:
                module_navigation = await asyncio.wait_for(inspect_navigation(context), timeout=15)
            except Exception:
                module_navigation = []
            (folder/'institution-navigation.json').write_text(
                json.dumps({'schema':'eworks.gib.navigation.v1',
                            'observations':module_navigation},ensure_ascii=False),encoding='utf-8')
            if request.get('moduleInspection') in ('notices','declarations','ledgers','all','declarations_notices'):
                from institution_discovery import inspect_module_screen
                report(folder,'running','Sözleşmeler doğrulandı. Kurum menüsü ve liste başlıkları inceleniyor; belge açılmıyor.')
                # e-Defter OAuth mevcut DVD oturumunu etkileyebiliyor.
                # Önce aynı oturumdaki e-Tebligat'ı gözle, ayrı girişi sona bırak.
                modules=(('notices','declarations','ledgers') if request['moduleInspection']=='all'
                    else ('notices','declarations') if request['moduleInspection']=='declarations_notices'
                    else (request['moduleInspection'],))
                screens=[]
                async def module_credentials_provider():
                    if not institution_token:
                        raise ValueError('Müşavir oturumu gerekli.')
                    return await asyncio.to_thread(fetch_credentials,institution_token,request['ownerId'])
                for module in modules:
                    if (folder/'cancel').exists():
                        raise ValueError('İş kullanıcı tarafından iptal edildi.')
                    try:
                        screen=await asyncio.wait_for(inspect_module_screen(context,module,module_credentials_provider,
                            preferred_page=page,keep_open=(module=='notices' and (len(modules)==1 or request['moduleInspection']=='declarations_notices'))),timeout=100)
                    except Exception as exc:
                        screen={'module':module,'state':'inspection_failed','failureType':type(exc).__name__,'imported':False}
                    screens.append(screen)
                    (folder/'institution-screen.json').write_text(json.dumps({'screens':screens},ensure_ascii=False),encoding='utf-8')
                hold=request.get('inspectionHoldSeconds',0)
                if type(hold) is int and 0<hold<=600:
                    from institution_discovery import observe_context_structure
                    import importlib
                    import institution_discovery
                    structure_version=Path(institution_discovery.__file__).stat().st_mtime_ns
                    institution_visited=set()
                    report(folder,'running','Kurum inceleme oturumu açık. Yalnızca liste başlıkları gözleniyor; belge içerikleri açılmaz. İnceleme bitince sözleşmeler kaydedilecek.')
                    until=asyncio.get_running_loop().time()+hold
                    while asyncio.get_running_loop().time()<until:
                        if (folder/'cancel').exists():
                            raise ValueError('İş kullanıcı tarafından iptal edildi.')
                        if (folder/'finish-inspection').exists() or not context.pages:
                            break
                        try:
                            current_version=Path(institution_discovery.__file__).stat().st_mtime_ns
                            if current_version!=structure_version:
                                importlib.reload(institution_discovery)
                                structure_version=current_version
                            try:
                                navigation_state=await asyncio.wait_for(institution_discovery.institution_navigation_step(context,institution_visited),timeout=10)
                            except Exception as exc:
                                navigation_state=type(exc).__name__
                            shape=await asyncio.wait_for(institution_discovery.observe_context_structure(context),timeout=10)
                            shape['navigationState']=navigation_state
                            (folder/'institution-live-structure.json').write_text(json.dumps(shape,ensure_ascii=False),encoding='utf-8')
                        except Exception:
                            pass
                        await asyncio.sleep(3)
                institution_token=''
            batch = {'schema': 'eworks.gib.contracts.v1', 'sourceType': 'gib_live',
                     'source': 'GİB / '+TITLE, 'exportedAt': datetime.now(timezone.utc).isoformat(),
                     'count': len(records), 'contracts': records,
                     'requestId': request['requestId'], 'ownerId': request['ownerId'],
                     'moduleNavigation': module_navigation}
            sys.stdout.buffer.write(json.dumps(batch, ensure_ascii=False).encode('utf-8'))
        finally:
            await browser.close()


def main():
    folder = Path(sys.argv[1]).resolve()
    try:
        startup = json.loads(sys.stdin.buffer.read(8193).decode('utf-8'))
        access_token = startup.pop('accessToken', '')
        startup.clear()
        request=json.loads((folder/'request.json').read_text(encoding='utf-8'))
        asyncio.run(asyncio.wait_for(run(folder, access_token), timeout=7200 if request.get('declarationSync') else 900))
        return 0
    except Exception as exc:
        import traceback
        try:atomic_json(folder/'worker-failure.json',dict(errorType=type(exc).__name__,frames=[dict(file=Path(f.filename).name,function=f.name,line=f.lineno) for f in traceback.extract_tb(exc.__traceback__)]))
        except OSError:pass
        try:
            from declaration_sync import recover_checkpoint
            request=json.loads((folder/'request.json').read_text(encoding='utf-8'))
            recovered=recover_checkpoint(folder,request,type(exc).__name__) if request.get('declarationSync') else None
            if recovered is not None:
                sys.stdout.buffer.write(json.dumps(recovered,ensure_ascii=False).encode('utf-8'))
                return 0
        except (OSError,ValueError,KeyError,TypeError):pass
        message = str(exc) if isinstance(exc, ValueError) else f'GİB işi tamamlanamadı ({type(exc).__name__}).'
        report(folder, 'failed', message)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
