import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock,patch
from playwright.async_api import async_playwright
from muhsgk_sgk_reader import collect_sgk,normalize_child

PARENT=dict(identity='1234567890',recordId='parent-source',document='MUHSGK',period='2026-06',metadata={'periodEnd':'2026-06'})
DESC='Asıl, TÜM SİG.KOLLARI, 05510-Say.Kan.MYO, 06 / 2026, 07071671902034000, Yasal süresinde verilme'

class SgkTests(unittest.IsolatedAsyncioTestCase):
    def test_only_observed_source_errors_are_classified_as_unavailable(self):
        from declaration_document_adapter import source_document_error,DocumentUnavailable
        for text in ('Tahakkuku görüntüleyemezsiniz. SGK mesajı: İşlem Başarısız! EBIL_GD_BILDIRGE Kayıt Yok',
                     '<p>Hizmet dökümünü görüntüleyemezsiniz. SGK mesajı: İşlem Başarısız!</p>'):
            self.assertIsInstance(source_document_error(text),DocumentUnavailable)
        self.assertIsNone(source_document_error('Oturum zamanaşımına uğradı.'))

    def test_period_and_actual_workplace_are_required(self):
        source=dict(id='rowsgk-source',cells=['06/2026-06/2026',DESC,'Hatalı',''])
        child=normalize_child(source,PARENT)
        self.assertEqual(child['workplace'],'07071671902034000');self.assertEqual(child['status'],'Hatalı')
        self.assertEqual(child['_pdfs'],[])
        for description in [DESC.replace('06 / 2026','07 / 2026'),DESC.replace('07071671902034000','unknown')]:
            with self.assertRaises(ValueError):normalize_child(dict(source,cells=[source['cells'][0],description,'Hatalı','']),PARENT)

    async def run_source(self,approved=False,missing=False,malformed=False,cached=False):
        html='''<table><tr id="rowparent-source"><td><img width="20" height="20" onclick="beyannameSGKBildirimleriGoster('parent-source',false)"></td></tr></table>
        <div id="bynGoruntu" hidden>
         <div id="bynGoruntu_close" onclick='Windows.close("bynGoruntu", event)'>close</div>
         <img onclick="window.submitted=true" title="Paket Onay İsteği Gönder">
         <table id="tahakkukTable"><tr><th>Vergilendirme Dönemi</th><th>Açıklama</th><th>Vergi Tahakkuku Durumu</th><th></th></tr>
          <tr id="rowparent-source"><td>06/2026-06/2026</td><td>Vergi</td><td>İptal</td><td></td></tr>
          <tr id="rowsgk-source"><td>06/2026-06/2026</td><td>'''+DESC+'''</td><td>Hatalı</td><td><img onclick="mesajButtonClick('sgk-source')"></td></tr></table>
         <table><tr><td>1 - 2 / 2</td><td><input type="button" title="Sonraki Sayfa" disabled></td></tr></table>
        </div><script>function beyannameSGKBildirimleriGoster(){document.getElementById('bynGoruntu').hidden=false}
        const Windows={close:()=>document.getElementById('bynGoruntu').hidden=true};</script>'''
        if approved:
            html=html.replace('Hatalı</td><td><img onclick="mesajButtonClick(\'sgk-source\')">', '''Onaylandı</td><td><img title="Tahakkuku PDF Formatında görüntülemek için tıklayınız." onclick="sgkTahakkukGoruntule('parent-source','sgk-source',false,false)"><img title="Hizmet Dökümünü PDF Formatında görüntülemek için tıklayınız." onclick="sgkHizmetGoruntule('parent-source','sgk-source',false,false)">''')
        if malformed:html=html.replace("mesajButtonClick('sgk-source')","unexpectedSourceAction('sgk-source')")
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(channel='chrome',headless=True)
            context=await browser.new_context();await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
            page=await context.new_page();await page.goto('https://ebeyanname.gib.gov.tr/synthetic')
            with tempfile.TemporaryDirectory() as directory:
                if malformed:
                    with self.assertRaisesRegex(ValueError,'belge kontrolleri değişti'):
                        await collect_sgk(page.main_frame,dict(PARENT),Path(directory),lambda *args:None)
                    self.assertFalse(await page.locator('#bynGoruntu').is_visible())
                    self.assertIsNone(await page.evaluate('window.submitted'))
                    await browser.close();return
                with patch('declaration_document_adapter.download_one',new_callable=AsyncMock,return_value=b'test-pdf') as download,patch('declaration_documents.validate_pdf',return_value='a'*64):
                    if missing:
                        from declaration_document_adapter import DocumentUnavailable
                        download.side_effect=[DocumentUnavailable('GİB/SGK: EBIL_GD_BILDIRGE Kayıt Yok; belge sunulmadı.'),b'test-pdf']
                    provider=AsyncMock(return_value=[dict(kind='sgk_accrual'),dict(kind='sgk_service')]) if cached else None
                    result=await collect_sgk(page.main_frame,dict(PARENT),Path(directory),lambda *args:None,provider)
                    self.assertEqual(len(result),1);self.assertEqual(result[0]['status'],'Onaylandı' if approved else 'Hatalı')
                    self.assertEqual(result[0]['_pdfs'],[] if cached else [('sgk_service',b'test-pdf')] if missing else [('sgk_accrual',b'test-pdf'),('sgk_service',b'test-pdf')] if approved else [])
                    if missing:self.assertTrue(result[0]['metadata']['documentWarnings'][0]['sourceUnavailable'])
                    self.assertEqual(download.await_count,0 if cached else 2 if approved else 0)
                self.assertIsNone(await page.evaluate('window.submitted'))
                self.assertFalse(await page.locator('#bynGoruntu').is_visible())
            await browser.close()

    async def test_source_rows_without_pdfs_preserve_errors_and_never_submit(self):await self.run_source()

    async def test_approved_source_downloads_both_bound_pdf_controls_only(self):await self.run_source(True)

    async def test_missing_accrual_keeps_service_pdf_and_source_warning(self):await self.run_source(True,True)

    async def test_reader_error_closes_detail_and_never_submits(self):await self.run_source(malformed=True)

    async def test_verified_cached_kinds_are_not_downloaded_again(self):await self.run_source(True,cached=True)

if __name__=='__main__':unittest.main()
