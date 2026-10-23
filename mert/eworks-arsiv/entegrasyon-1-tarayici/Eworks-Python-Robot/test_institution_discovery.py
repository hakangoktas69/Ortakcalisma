import unittest
from institution_discovery import safe_origin, inspect_navigation
from institution_discovery import inspect_module_screen, observe_context_structure
from unittest.mock import patch, AsyncMock
from playwright.async_api import async_playwright


class OriginTests(unittest.TestCase):
    def test_removes_session_query_path_and_fragment(self):
        self.assertEqual(safe_origin('https://intvrg.gib.gov.tr/private?token=synthetic#x'),
                         'https://intvrg.gib.gov.tr')

    def test_rejects_untrusted_origins(self):
        for url in ['http://intvrg.gib.gov.tr', 'https://gib.gov.tr.evil.invalid',
                    'https://user:password@gib.gov.tr', 'https://gib.gov.tr:444',
                    'https://gib.gov.tr:bad', 'about:blank']:
            self.assertIsNone(safe_origin(url))


class ObservationTests(unittest.IsolatedAsyncioTestCase):
    async def test_unknown_module_is_rejected_before_access(self):
        with self.assertRaises(ValueError):
            await inspect_module_screen(None,'unknown')

    async def test_observation_never_clicks_or_returns_rows(self):
        class Candidate:
            async def is_visible(self): return True
        class Locator:
            def __init__(self, label): self.label=label
            async def all(self): return [Candidate()] if self.label=='e-Tebligat' else []
        class Frame:
            url='https://intvrg.gib.gov.tr/private?token=synthetic'
            def get_by_text(self, label, exact=False):
                self_test.assertTrue(exact)
                return Locator(label)
        self_test=self
        class Page:
            url=Frame.url
            frames=[Frame()]
        class Context: pages=[Page()]
        result=await inspect_navigation(Context())
        self.assertEqual(result,[dict(module='notices',sourceOrigin='https://intvrg.gib.gov.tr',
            visibleMenuLabels=['e-Tebligat'],state='navigation_observed',imported=False)])


class ScreenTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Sentetik gezinme testleri yerel canlı pilot ayarını kullanmaz.
        config_patch=patch('institution_discovery.Path.read_text',return_value='{}')
        config_patch.start()
        self.addCleanup(config_patch.stop)

    async def test_legacy_notice_inspection_does_not_fall_back_to_personal_dvd(self):
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body='<button onclick="window.clicked=true">e-Tebligat</button>',content_type='text/html; charset=utf-8'))
                page=await context.new_page();await page.goto('https://dijital.gib.gov.tr/synthetic')
                with patch('institution_discovery.Path.read_text',return_value='{"noticeSourcePreference":"legacy"}'):
                    result=await inspect_module_screen(context,'notices',preferred_page=page)
                self.assertEqual(result['state'],'menu_unavailable')
                self.assertIsNone(await page.evaluate('window.clicked'))
            finally:await browser.close()

    async def test_notice_grid_scope_diagnostics_do_not_read_documents(self):
        headers=['','Gönderen Kurum','Alt Birim','Belge Türü','Belge No','Gönderme Tarihi','Tebliğ Tarihi','Mükellef Okuma Tarihi']
        html='<div role="grid"><div role="row">'+''.join('<div role="columnheader">'+h+'</div>' for h in headers)+'</div>'
        html+='<div role="row"><div role="gridcell">PRIVATE-NOTICE-SENTINEL</div><button onclick="window.opened=true">Belgeyi Aç</button></div></div>'
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://dijital.gib.gov.tr/synthetic')
                shape=await observe_context_structure(context)
                self.assertEqual(shape['frames'][0]['noticeStructure']['tables'][0]['visibleRowContainers'],1)
                self.assertNotIn('PRIVATE-NOTICE',str(shape))
                self.assertIsNone(await page.evaluate('window.opened'))
            finally:await browser.close()

    async def test_single_notice_inspection_can_keep_list_open(self):
        html='''<button onclick="history.pushState({},'', '/synthetic-notices');document.querySelector('table').hidden=false">e-Tebligat</button>
        <table hidden><thead><tr><th>Gönderen Kurum</th></tr></thead></table>'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://dijital.gib.gov.tr/synthetic')
                with patch('institution_discovery.asyncio.sleep',new_callable=AsyncMock):
                    result=await inspect_module_screen(context,'notices',keep_open=True)
                self.assertNotIn('returnedToStart',result)
                self.assertTrue(page.url.endswith('/synthetic-notices'))
            finally:await browser.close()

    async def test_next_month_closes_only_verified_declaration_result_window(self):
        import json
        from institution_discovery import declaration_pilot_query
        html='''<div id="bynList2" class="dialog"><h2>Beyanname Listesi</h2>
        <div id="bynList2_close" class="alphacube_close" onclick='Windows.close("bynList2", event)'>X</div></div>
        <button onclick="window.documentOpened=true">Belgeyi Aç</button>
        <script>window.Windows={close:(id,event)=>{document.getElementById(id).hidden=true;window.closedList=true}}</script>'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://ebeyanname.gib.gov.tr/synthetic')
                page._eworks_pilot_scope={'year':2026,'uploadMonth':7}
                cfg={'declarationPilot':{'enabled':True,'taxNumber':'1234567890','year':2026,'uploadMonth':8}}
                with patch('institution_discovery.Path.read_text',return_value=json.dumps(cfg)):
                    self.assertEqual(await declaration_pilot_query(page,set()),'pilot_previous_result_closed')
                self.assertTrue(await page.evaluate('window.closedList'))
                self.assertIsNone(await page.evaluate('window.documentOpened'))
            finally:
                await browser.close()

    async def test_calendar_uses_buttons_and_verifies_locked_fields(self):
        from institution_discovery import select_legacy_calendar_date
        html='''<input name="baslangicTarihiGun" value="01" disabled>
        <input name="baslangicTarihiAy" value="01" disabled>
        <input name="baslangicTarihiYil" value="2026" disabled>
        <input type="button" name="baslangicTarihiBtn" onclick="document.querySelector('#picker').hidden=false">
        <div id="picker" hidden><input id="dpYear" value="2026" disabled><input id="dpMonth" value="Ocak" disabled>
        <input type="button" value="X" onclick="document.querySelector('#picker').hidden=true">
        <input type="button" onclick="increaseMonth()"><input type="button" onclick="decreaseMonth()">
        <input type="button" id="d6" value="" onclick="setDate(this)"></div>
        <script>
        document.querySelector('#d6').value='01';
        function increaseMonth(){document.querySelector('#dpMonth').value='Şubat'}
        function decreaseMonth(){document.querySelector('#dpMonth').value='Ocak'}
        function setDate(el){document.querySelector('[name=baslangicTarihiGun]').value=el.value;
          document.querySelector('[name=baslangicTarihiAy]').value='02';
          document.querySelector('#picker').hidden=true}
        </script>'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://ebeyanname.gib.gov.tr/synthetic')
                self.assertTrue(await select_legacy_calendar_date(page,'baslangic',2026,2,1))
                self.assertEqual(await page.locator('[name=baslangicTarihiAy]').input_value(),'02')
                self.assertTrue(await page.locator('[name=baslangicTarihiAy]').is_disabled())
            finally:
                await browser.close()

    async def test_pilot_query_waits_for_locked_calendar_dates(self):
        import json
        from institution_discovery import declaration_pilot_query
        html='<table><tr><td>Vergi Kimlik Numarası</td><td><input name="vergiNo"></td></tr></table>'
        html+=''.join('<input type="checkbox" name="sorguTipi'+s+'">' for s in ('N','T','B','P','V','Z','D'))
        html+='<input name="baslangicTarihiGun" value="13" disabled><input name="baslangicTarihiAy" value="10" disabled><input name="baslangicTarihiYil" value="2026" disabled><input type="button" name="sorgulaButon" value="Sorgula" onclick="window.sent=true">'
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://ebeyanname.gib.gov.tr/synthetic')
                cfg={'declarationPilot':{'enabled':True,'taxNumber':'1234567890','year':2026}}
                with patch('institution_discovery.Path.read_text',return_value=json.dumps(cfg)):
                    self.assertEqual(await declaration_pilot_query(page,set()),'pilot_date_picker_required')
                self.assertIsNone(await page.evaluate('window.sent'))
                self.assertEqual(await page.locator('[name=baslangicTarihiGun]').input_value(),'13')
            finally:
                await browser.close()

    async def test_monthly_pilot_query_records_warning_and_never_resubmits(self):
        import json
        from institution_discovery import declaration_pilot_query
        html='<table><tr><td>Vergi Kimlik Numarası</td><td><input name="vergiNo"></td></tr></table>'
        html+=''.join('<input type="checkbox" name="sorguTipi'+s+'">' for s in ('N','T','B','P','V','Z','D'))
        for name,value in (('baslangicTarihiGun','01'),('baslangicTarihiAy','01'),('baslangicTarihiYil','2026'),
                           ('bitisTarihiGun','31'),('bitisTarihiAy','01'),('bitisTarihiYil','2026')):
            html+='<input disabled name="'+name+'" value="'+value+'">'
        for name in ('donemBasAy','donemBitAy'):
            html+='<select name="'+name+'"><option value="1">Ocak</option><option value="12">Aralık</option></select>'
        for name in ('donemBasYil','donemBitYil'):
            html+='<select name="'+name+'"><option>2026</option></select>'
        html+='''<input type="button" name="sorgulaButon" value="Sorgula"
            onclick="window.sends=(window.sends||0)+1;alert('Sorgu uyarısı 1234567890')">'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://ebeyanname.gib.gov.tr/synthetic')
                cfg={'declarationPilot':{'enabled':True,'taxNumber':'1234567890','year':2026,'uploadMonth':1}}
                visited=set()
                with patch('institution_discovery.Path.read_text',return_value=json.dumps(cfg)):
                    self.assertEqual(await declaration_pilot_query(page,visited),'pilot_declaration_query_submitted')
                    self.assertIsNone(await declaration_pilot_query(page,visited))
                self.assertEqual(await page.evaluate('window.sends'),1)
                self.assertEqual(page._eworks_pilot_dialog['message'],'Sorgu uyarısı [redacted]')
            finally:
                await browser.close()

    async def test_legacy_declaration_search_opens_once_without_submitting(self):
        from institution_discovery import institution_navigation_step
        html='''<a href="#" onclick="window.opened=(window.opened||0)+1;return false">Beyanname Ara</a>
        <button onclick="window.submitted=true">Sorgula</button>
        <input name="vergiNo" value="PRIVATE-TAX-SENTINEL">
        <select name="donem"><option>PRIVATE-OPTION-SENTINEL</option></select>'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://ebeyanname.gib.gov.tr/synthetic')
                visited=set()
                self.assertEqual(await institution_navigation_step(context,visited),'Beyanname Ara')
                self.assertIsNone(await institution_navigation_step(context,visited))
                self.assertEqual(await page.evaluate('window.opened'),1)
                self.assertIsNone(await page.evaluate('window.submitted'))
                shape=await observe_context_structure(context)
                self.assertNotIn('PRIVATE-',str(shape))
                self.assertEqual(shape['frames'][0]['formStructure'][0]['name'],'vergiNo')
            finally:
                await browser.close()

    async def test_transition_confirmation_does_not_reopen_application_card(self):
        from institution_discovery import institution_navigation_step
        html='''<section><h2>Yönlendirmeyi Onaylıyor Musunuz?</h2>
        <p>e-Beyanname uygulamasına geçiş yapmak üzeresiniz.
        Bu oturum üzerinden daha önce başlattığınız aktif e-Beyanname oturumlarınız da sonlandırılacaktır.
        Devam etmek istiyor musunuz?</p>
        <button onclick="this.parentElement.hidden=true;window.confirmed=true">ONAYLA</button>
        <button>İPTAL ET</button></section>
        <button onclick="window.reopened=true">e-Beyanname</button>'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://dijital.gib.gov.tr/synthetic')
                page._eworks_institution_module='declarations'
                visited=set()
                self.assertEqual(await institution_navigation_step(context,visited),'e-Beyanname yönlendirme onayı')
                self.assertTrue(await page.evaluate('window.confirmed'))
                self.assertIsNone(await institution_navigation_step(context,visited))
                self.assertIsNone(await page.evaluate('window.reopened'))
            finally:
                await browser.close()

    async def test_structure_diagnostics_exclude_private_rows_and_inputs(self):
        html='''<div role="alert">Forbidden</div><table><thead><tr><th>Belge No</th></tr></thead>
        <tbody><tr><td>PRIVATE-ROW-SENTINEL</td></tr></tbody></table>
        <input type="password" value="PRIVATE-SECRET-SENTINEL">'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://dijital.gib.gov.tr/synthetic?state=PRIVATE-SESSION-SENTINEL')
                result=await observe_context_structure(context)
                self.assertEqual(result['frames'][0]['interfaceFlags'],['forbidden'])
                self.assertNotIn('PRIVATE-',str(result))
                self.assertEqual(result['frames'][0]['tables'],[['Belge No']])
            finally:
                await browser.close()

    async def test_archive_list_does_not_open_document(self):
        html='''<button onclick="document.querySelector('#archive').hidden=false">e-Tebligat</button>
        <button id="archive" hidden onclick="document.querySelector('table').hidden=false">ARŞİVLENEN TEBLİGATLAR</button>
        <table hidden><thead><tr><th>Tebligat Durumu</th></tr></thead><tbody><tr><td>
        <button onclick="window.documentOpened=true">Belgeyi Aç</button></td></tr></tbody></table>'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                page=await context.new_page()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                await page.goto('https://dijital.gib.gov.tr/synthetic')
                with patch('institution_discovery.asyncio.sleep',new_callable=AsyncMock):
                    result=await inspect_module_screen(context,'notices')
                self.assertEqual(result['openedListLabel'],'ARŞİVLENEN TEBLİGATLAR')
                self.assertEqual(result['tables'][0]['headers'],['Tebligat Durumu'])
                self.assertIsNone(await page.evaluate('window.documentOpened'))
            finally:
                await browser.close()

    async def test_menu_only_headers_no_document_clicks_or_rows(self):
        html='''<button onclick="history.pushState({},'', '/synthetic-notices');document.querySelector('#notices').hidden=false">e-Tebligat</button>
        <table><thead><tr><th>Eski Sözleşme Tablosu</th></tr></thead></table>
        <table id="notices" hidden><thead><tr><th>Belge Türü</th><th>Durum</th></tr></thead>
        <tbody><tr><td>SYNTHETIC-PRIVATE-ROW</td><td>
        <button onclick="window.documentOpened=true">Belgeyi Aç</button></td></tr></tbody></table>'''
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                page=await context.new_page()
                await context.route('**/*',lambda route: route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                await page.goto('https://dijital.gib.gov.tr/synthetic?session=synthetic')
                other=await context.new_page()
                await other.route('**/*',lambda route: route.fulfill(body='<table><thead><tr><th>Başka Sekmedeki Sözleşmeler</th></tr></thead></table>',content_type='text/html; charset=utf-8'))
                await other.goto('https://intvrg.gib.gov.tr/synthetic')
                with patch('institution_discovery.asyncio.sleep',new_callable=AsyncMock):
                    result=await inspect_module_screen(context,'notices')
                self.assertEqual(result['tables'],[dict(sourceOrigin='https://dijital.gib.gov.tr',headers=['Belge Türü','Durum'])])
                self.assertFalse(result['imported'])
                self.assertEqual(result['state'],'new_table_headers_observed')
                self.assertTrue(result['returnedToStart'])
                self.assertEqual(page.url,'https://dijital.gib.gov.tr/synthetic?session=synthetic')
                self.assertNotIn('SYNTHETIC-PRIVATE-ROW',str(result))
                self.assertNotIn('session=',str(result))
                self.assertIsNone(await page.evaluate('window.documentOpened'))
            finally:
                await browser.close()

    async def test_official_application_entry_reports_reauthentication(self):
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                async def route_request(route):
                    if route.request.url.startswith('https://edefter.gib.gov.tr/'):
                        html='''<button onclick="location.href='https://dijital.gib.gov.tr/portal/oauth?state=synthetic'">e-Defter Logo ile Giriş Yap</button>'''
                    else:
                        html='<input type="password"><label>Doğrulama Kodu</label>'
                    await route.fulfill(body=html,content_type='text/html; charset=utf-8')
                await context.route('**/*',route_request)
                with patch('institution_discovery.asyncio.sleep',new_callable=AsyncMock):
                    result=await inspect_module_screen(context,'ledgers')
                self.assertEqual(result['state'],'reauthentication_required')
                self.assertFalse(result['imported'])
                self.assertNotIn('state=synthetic',str(result))
            finally:
                await browser.close()
