import io
import unittest
from unittest.mock import patch,Mock,AsyncMock
import tempfile
from pathlib import Path
from playwright.async_api import async_playwright
from pypdf import PdfWriter
from declaration_documents import validate_pdf,store_pdf,BUCKET,verified_existing,known_documents,DocumentCollector
from declaration_document_adapter import trusted_pdf_source
from declaration_document_adapter import download_documents

OWNER='11111111-1111-4111-8111-111111111111'

def synthetic_pdf():
    writer=PdfWriter();writer.add_blank_page(width=200,height=200)
    stream=io.BytesIO();writer.write(stream);return stream.getvalue()

class DocumentsTests(unittest.TestCase):
    def test_pdf_rejects_login_html_truncation_and_encrypted_content(self):
        valid=synthetic_pdf();self.assertEqual(len(validate_pdf(valid)),64)
        for invalid in (b'<html>Sign in</html>'*100,valid[:-20],b'%PDF-'+b'x'*500+b'%%EOF'):
            with self.assertRaises(ValueError):validate_pdf(invalid)
        writer=PdfWriter();writer.add_blank_page(width=200,height=200);writer.encrypt('synthetic')
        stream=io.BytesIO();writer.write(stream)
        with self.assertRaises(ValueError):validate_pdf(stream.getvalue())

    def test_upload_requires_readback_digest_and_exact_owner_key(self):
        raw=synthetic_pdf()
        args=dict(owner=OWNER,identity='1234567890',record_id='source-1',kind='declaration',access_token='synthetic-token')
        with patch('declaration_documents.requests.post',return_value=Mock(status_code=201)) as upload,patch('declaration_documents.requests.get',return_value=Mock(status_code=200,content=raw)):
            result=store_pdf(raw,**args)
            self.assertTrue(result['storageVerified']);self.assertTrue(result['key'].startswith(OWNER+'/1234567890/source-1/'))
            self.assertEqual(result['bucket'],BUCKET);self.assertNotIn('synthetic-token',str(result))
            self.assertFalse(upload.call_args.kwargs['allow_redirects'])
        with patch('declaration_documents.requests.post',return_value=Mock(status_code=409)),patch('declaration_documents.requests.get',return_value=Mock(status_code=200,content=b'foreign PDF')):
            with self.assertRaisesRegex(ValueError,'geri okuma'):store_pdf(raw,**args)

    def test_pdf_capture_only_exact_gib_origin(self):
        self.assertTrue(trusted_pdf_source('https://ebeyanname.gib.gov.tr/dispatch'))
        for url in ['http://ebeyanname.gib.gov.tr/dispatch','https://ebeyanname.gib.gov.tr.evil.test/x','https://evil.test/x','https://user@ebeyanname.gib.gov.tr/x']:
            self.assertFalse(trusted_pdf_source(url))

    def test_existing_document_is_read_verified_and_foreign_scope_rejected(self):
        raw=synthetic_pdf();digest=validate_pdf(raw)
        file=dict(ownerId=OWNER,identity='1234567890',recordId='source-1',kind='declaration',bucket=BUCKET,
            sha256=digest,size=len(raw),savedAt='2026-10-21T12:00:00Z',key=f'{OWNER}/1234567890/source-1/declaration-{digest}.pdf')
        with patch('declaration_documents.requests.get',return_value=Mock(status_code=200,content=raw)):
            self.assertEqual(verified_existing([file],owner=OWNER,identity='1234567890',record_id='source-1',access_token='synthetic'),[file])
            with self.assertRaises(ValueError):verified_existing([file],owner=OWNER,identity='9999999999',record_id='source-1',access_token='synthetic')

class AdapterTests(unittest.IsolatedAsyncioTestCase):
    async def test_existing_employee_count_reused_only_for_matching_record_hash(self):
        identity='1234567890';record='source-1';digest='a'*64
        file={'ownerId':OWNER,'identity':identity,'recordId':record,'kind':'sgk_service','sha256':digest,'storageVerified':True}
        proof={'identity':identity,'recordId':record,'employeeCount':7,'method':'sgk_service_unique_persons','sourceSha256':digest}
        row={'ownerId':OWNER,'identity':identity,'recordId':record,'page':'sgk-bildirge','sourceType':'gib_muhsgk',
            'attachments':[file],'metadata':{'employeeCount':7,'employeeCountSource':proof}}
        for matches in (True,False):
            proof['sourceSha256']=digest if matches else 'b'*64
            with patch('declaration_documents.requests.get',return_value=Mock(status_code=200,json=lambda:[{'payload':{'notes':[row]}}])):
                known=known_documents(OWNER,'synthetic')
            with tempfile.TemporaryDirectory() as temp,patch('declaration_documents.verified_existing',return_value=[{**file,'employeeCount':7}]) as verify:
                collector=DocumentCollector(Path(temp),OWNER,'synthetic',lambda *args:None,known=known)
                await collector.load_cached_employee_counts()
                self.assertEqual(verify.call_count,0 if matches else 1)
                self.assertEqual(collector.employee_count_updates[(identity,record)]['employeeCount'],7)

    async def test_live_control_binding_and_pdf_capture_without_external_requests(self):
        raw=synthetic_pdf()
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(channel='chrome',headless=True)
            context=await browser.new_context()
            html='''<table><tr id="rowsource-1"><td>
            <img title="Beyannameyi PDF Formatında görüntülemek için tıklayınız." onclick="beyannameGoruntule('source-1',false,false)" width="20" height="20">
            </td></tr></table><script>function beyannameGoruntule(){window.open('/synthetic.pdf')}</script>'''
            async def fulfill(route):
                if route.request.url.endswith('.pdf'):await route.fulfill(body=raw,content_type='application/pdf')
                else:await route.fulfill(body=html,content_type='text/html; charset=utf-8')
            await context.route('**/*',fulfill)
            page=await context.new_page();await page.goto('https://ebeyanname.gib.gov.tr/synthetic')
            copied=Mock(status=200,body=AsyncMock(return_value=raw),dispose=AsyncMock())
            with tempfile.TemporaryDirectory() as temp,patch.object(context.request,'fetch',AsyncMock(return_value=copied)):
                files=await download_documents(page.main_frame,dict(recordId='source-1'),Path(temp),lambda *args:None)
                self.assertEqual(files,[('declaration',raw)])
                with patch('declaration_document_adapter.download_one',AsyncMock(side_effect=AssertionError('Already saved PDF requested'))):
                    skipped=await download_documents(page.main_frame,dict(recordId='source-1',attachments=[{'kind':'declaration'}]),Path(temp),lambda *args:None)
                    self.assertEqual(skipped,[])
                await page.locator('img').evaluate("el=>el.setAttribute('onclick',\"beyannameGoruntule('foreign-record',false,false)\")")
                with self.assertRaisesRegex(ValueError,'kimliği'):await download_documents(page.main_frame,dict(recordId='source-1'),Path(temp),lambda *args:None)
            await browser.close()

if __name__=='__main__':unittest.main()
