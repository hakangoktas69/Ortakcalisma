import unittest
from playwright.async_api import async_playwright
from declaration_reader import HEADERS,read_declaration_page


class ReaderTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.playwright=await async_playwright().start()
        self.browser=await self.playwright.chromium.launch(channel='chrome',headless=True)
        self.context=await self.browser.new_context()
        self.page=await self.context.new_page()

    async def asyncTearDown(self):
        await self.browser.close()
        await self.playwright.stop()

    async def load(self,*,identity='1234567890',paging='1 - 1 / 1',disabled=True,hidden=False):
        cells=['','KDV1',identity,'PRIVATE-NAME-SENTINEL','Office','06/2026-06/2026','','28.07.2026 - 11:43:37','Onaylandı','']
        html='<table'+(' hidden' if hidden else '')+'><tr>'+''.join('<td>'+h+'</td>' for h in HEADERS)+'</tr>'
        html+='<tr id="rowsynthetic-1" title="000000_1234567890_KDV1_1_01062026-30062026.xml   28.07.2026 - 11:43:37">'
        html+=''.join('<td>'+v+'</td>' for v in cells)+'</tr></table>'
        html+='<table><tr><td>'+paging+'</td><td><input type="image" title="Sonraki Sayfa"'+(' disabled' if disabled else '')+'></td></tr></table>'
        html+='<button onclick="window.documentOpened=true">Belgeyi Aç</button>'
        await self.context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
        await self.page.goto('https://ebeyanname.gib.gov.tr/synthetic')

    async def read(self):
        return await read_declaration_page(self.page.main_frame,identity='1234567890',year=2026,upload_month=7)

    async def test_reads_complete_page_without_document_or_authority_claim(self):
        await self.load()
        result=await self.read()
        self.assertEqual(result['observedCount'],1)
        self.assertTrue(result['singlePageVerified'])
        self.assertFalse(result['authorizationVerified'])
        self.assertFalse(result['imported'])
        self.assertNotIn('PRIVATE-NAME',str(result))
        self.assertIsNone(await self.page.evaluate('window.documentOpened'))

    async def test_rejects_wrong_firm(self):
        await self.load(identity='9999999999')
        with self.assertRaises(ValueError):await self.read()

    async def test_rejects_incomplete_pagination(self):
        await self.load(paging='1 - 1 / 2',disabled=False)
        with self.assertRaises(ValueError):await self.read()

    async def test_ignores_hidden_old_result(self):
        await self.load(hidden=True)
        self.assertIsNone(await self.read())

    async def test_missing_filename_preserves_long_source_id_and_rejects_row_number(self):
        await self.load()
        await self.page.locator('#rowsynthetic-1').evaluate("el=>el.title=''")
        row=(await self.read())['records'][0]
        self.assertEqual(row['reference'],'synthetic-1')
        self.assertEqual(row['metadata']['referenceType'],'source_record_id')
        await self.page.locator('#rowsynthetic-1').evaluate("el=>el.id='row1'")
        with self.assertRaises(ValueError):await self.read()

    async def test_collects_all_pages_without_opening_documents(self):
        from declaration_reader import read_declaration_pages
        await self.load(paging='1 - 1 / 2',disabled=False)
        await self.page.locator('input[title="Sonraki Sayfa"]').evaluate('''el=>{
            el.type='button';el.onclick=()=>{
                const row=document.getElementById('rowsynthetic-1');row.id='rowsynthetic-2';
                row.title=row.title.replace('_1_','_2_');
                el.closest('tr').cells[0].textContent='2 - 2 / 2';el.disabled=true;
            };
        }''')
        rows=await read_declaration_pages(self.page.main_frame,identity='1234567890',year=2026,upload_month=7)
        self.assertEqual([r['recordId'] for r in rows],['synthetic-1','synthetic-2'])
        self.assertIsNone(await self.page.evaluate('window.documentOpened'))

    async def test_pagination_rejects_duplicate_rows(self):
        from declaration_reader import read_declaration_pages
        await self.load(paging='1 - 1 / 2',disabled=False)
        await self.page.locator('input[title="Sonraki Sayfa"]').evaluate('''el=>{
            el.type='button';el.onclick=()=>{el.closest('tr').cells[0].textContent='2 - 2 / 2';el.disabled=true;};
        }''')
        with self.assertRaisesRegex(ValueError,'mükerrer'):
            await read_declaration_pages(self.page.main_frame,identity='1234567890',year=2026,upload_month=7)


if __name__=='__main__':unittest.main()
