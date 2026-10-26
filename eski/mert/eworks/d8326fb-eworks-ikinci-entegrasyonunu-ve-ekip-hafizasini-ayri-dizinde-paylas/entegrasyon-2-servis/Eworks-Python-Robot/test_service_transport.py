import io
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlencode
from pypdf import PdfWriter
from service_transport import ServiceTransport,validate_query


class Response:
    def __init__(self,body=b'<html>fixture</html>',status=200,mime='text/html'):
        self.status=status;self.url='https://ebeyanname.gib.gov.tr/dispatch'
        self.headers={'content-type':mime};self.raw=body;self.disposed=False
    async def body(self):return self.raw
    async def dispose(self):self.disposed=True


class Route:
    def __init__(self,request,response=None):
        self.request=request;self.response=response or Response();self.sent=0;self.forwarded=0;self.reply=None
    async def fetch(self,**kwargs):
        self.sent+=1;self.fetch_options=kwargs;return self.response
    async def fallback(self):self.forwarded+=1
    async def fulfill(self,**kwargs):self.reply=kwargs


class TransportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.folder=Path(self.tmp.name)
        self.context=SimpleNamespace()
        self.transport=ServiceTransport(self.context,self.folder)
        self.config={'taxNumber':'1234567890','startDate':'2026-07-22','endDate':'2026-07-31'}
        self.transport.begin_scope(self.config,[])

    def tearDown(self):self.tmp.cleanup()

    def query(self,**changes):
        data={'TOKEN':'SECRET_TOKEN','cmd':'synthetic-read','sorguTipiZ':'on','sorguTipiN':'on',
            'vergiNo':'1234567890','baslangicTarihi':'22.07.2026','bitisTarihi':'31.07.2026'}
        data.update(changes)
        return SimpleNamespace(method='POST',url='https://ebeyanname.gib.gov.tr/dispatch',post_data=urlencode(data))

    async def test_scoped_query_sent_once_then_identical_body_fulfilled(self):
        route=Route(self.query());await self.transport.handle(route)
        self.assertEqual(route.sent,1);self.assertEqual(route.forwarded,0)
        self.assertEqual(route.reply['body'],route.response.raw)
        self.assertEqual(route.fetch_options['max_redirects'],0);self.assertEqual(route.fetch_options['max_retries'],0)
        self.assertTrue(route.response.disposed)
        log=(self.folder/'service-transport-summary.json').read_text()
        self.assertNotIn('SECRET_TOKEN',log);self.assertNotIn('1234567890',log)
        self.assertEqual(json.loads(log)['queries'],1)

    async def test_wrong_identity_dates_unknown_fields_never_send(self):
        for changes in ({'vergiNo':'9876543210'},{'baslangicTarihi':'01.07.2026'},{'unknown':'value'},
                        {'sorguTipiT':'on'},{'sorguTipiD':'on','durum':'synthetic'}):
            route=Route(self.query(**changes));await self.transport.handle(route)
            self.assertEqual(route.sent,0);self.assertEqual(route.reply['status'],502)

    async def test_contract_alias_is_permitted_without_widening_dates(self):
        self.transport.begin_scope(self.config,['12345678901'])
        route=Route(self.query(sorguTipiN='',vergiNo='',sorguTipiT='on',tcKimlikNo='12345678901'))
        await self.transport.handle(route);self.assertEqual(route.sent,1)

    async def test_navigation_and_other_origin_are_not_intercepted(self):
        request=self.query();request.url='https://evil.example/dispatch'
        route=Route(request);await self.transport.handle(route);self.assertEqual(route.forwarded,1)
        request=self.query();request.post_data=urlencode({'cmd':'synthetic-menu','TOKEN':'SECRET_TOKEN'})
        route=Route(request);await self.transport.handle(route);self.assertEqual(route.forwarded,1)

    async def test_auth_rate_and_redirect_fail_without_retry(self):
        for status in (401,403,429,302):
            route=Route(self.query(),Response(status=status));await self.transport.handle(route)
            self.assertEqual(route.sent,1);self.assertEqual(route.reply['status'],502)

    async def test_pdf_is_cached_in_memory_once_and_never_written(self):
        writer=PdfWriter();writer.add_blank_page(width=100,height=100);stream=io.BytesIO();writer.write(stream);raw=stream.getvalue()
        request=SimpleNamespace(method='GET',post_data=None,url='https://ebeyanname.gib.gov.tr/dispatch?cmd=IMAJ&TOKEN=SECRET_TOKEN')
        self.transport.begin_pdf('declaration')
        route=Route(request,Response(raw,mime='application/pdf'));await self.transport.handle(route)
        self.assertEqual(route.sent,1);self.assertEqual(self.transport.take_pdf(request.url),raw)
        self.assertIsNone(self.transport.take_pdf(request.url))
        self.assertEqual([p.name for p in self.folder.iterdir()],['service-transport-summary.json'])

    async def test_source_html_not_cached_as_pdf(self):
        request=SimpleNamespace(method='GET',post_data=None,url='https://ebeyanname.gib.gov.tr/dispatch?cmd=IMAJ')
        self.transport.begin_pdf('sgk_service')
        route=Route(request,Response(b'EBIL_GD_BILDIRGE Kayit Yok'));await self.transport.handle(route)
        self.assertEqual(route.sent,1);self.assertIsNone(self.transport.take_pdf(request.url))
        self.assertEqual(self.transport.counts['pdfs'],0)

    async def test_cancel_never_sends_and_cache_clear_drops_bytes(self):
        (self.folder/'cancel').touch();route=Route(self.query());await self.transport.handle(route)
        self.assertEqual(route.sent,0)
        self.transport.pdf_cache[b'x']=b'synthetic';self.transport.end_pdf();self.assertEqual(self.transport.pdf_cache,{})


if __name__=='__main__':unittest.main()
