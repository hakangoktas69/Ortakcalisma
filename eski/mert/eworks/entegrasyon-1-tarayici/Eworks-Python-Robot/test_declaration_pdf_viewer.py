import io
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from pypdf import PdfWriter
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parent.parent/'Eworks-Portal'

class PdfViewerTests(unittest.IsolatedAsyncioTestCase):
    async def test_local_worker_renders_and_pages_without_external_viewer(self):
        writer=PdfWriter();writer.add_blank_page(width=400,height=600);writer.add_blank_page(width=600,height=400)
        buffer=io.BytesIO();writer.write(buffer)
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            context=await browser.new_context(viewport={'width':420,'height':700})
            async def serve(route):
                url=urlsplit(route.request.url);path=(ROOT/url.path.lstrip('/')).resolve()
                if url.hostname!='127.0.0.1':raise AssertionError('External viewer request')
                if url.path=='/synthetic':return await route.fulfill(body='<div id="preview" style="width:100%"></div>',content_type='text/html')
                if not path.is_relative_to(ROOT) or not path.is_file():return await route.abort()
                if url.path!='/declaration-pdf-viewer.mjs' and not url.path.startswith('/vendor/pdfjs/'):return await route.abort()
                await route.fulfill(body=path.read_bytes(),content_type='text/javascript' if path.suffix=='.mjs' else 'application/octet-stream')
            await context.route('**/*',serve)
            page=await context.new_page();await page.goto('http://127.0.0.1:8765/synthetic')
            await page.evaluate('''async bytes=>{
                const viewer=await import('/declaration-pdf-viewer.mjs');
                await viewer.render(new Uint8Array(bytes).buffer,document.getElementById('preview'));
            }''',list(buffer.getvalue()))
            self.assertEqual(await page.locator('#preview').get_attribute('data-rendered-page'),'1')
            self.assertEqual(await page.locator('#preview').get_attribute('data-page-count'),'2')
            self.assertGreater(await page.locator('canvas').evaluate('el=>el.width'),200)
            await page.get_by_role('button',name='Sonraki PDF sayfası').click()
            await page.locator('#preview[data-rendered-page="2"]').wait_for()
            self.assertTrue(await page.get_by_role('button',name='Sonraki PDF sayfası').is_disabled())
            await browser.close()

if __name__=='__main__':unittest.main()
