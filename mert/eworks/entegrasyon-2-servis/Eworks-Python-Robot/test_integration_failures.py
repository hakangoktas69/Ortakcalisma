import base64
import asyncio
import json
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch,Mock
from integration_errors import SessionBudgetExceeded,SourceBlockedError,StorageResponseError
from session_guard import SessionGuard
from declaration_documents import store_pdf,DocumentCollector
from test_declaration_documents import synthetic_pdf,OWNER
import test_service_transport as transport_tests


def token(seconds):
    payload=base64.urlsafe_b64encode(json.dumps({'exp':time.time()+seconds}).encode()).decode().rstrip('=')
    return 'synthetic.'+payload+'.signature'


class GuardTests(unittest.TestCase):
    def test_expiring_token_prevents_network_upload(self):
        with patch('declaration_documents.requests.post') as upload:
            with self.assertRaises(SessionBudgetExceeded):
                store_pdf(synthetic_pdf(),owner=OWNER,identity='1234567890',record_id='source-1',kind='declaration',access_token=token(99))
            upload.assert_not_called()

    def test_source_and_storage_have_separate_headroom(self):
        guard=SessionGuard(token(140))
        with self.assertRaises(SessionBudgetExceeded):guard.check_source()
        guard.check_storage()

    def test_absolute_deadline_blocks_source(self):
        guard=SessionGuard(token(3600));guard.run_deadline=time.monotonic()-1
        with self.assertRaises(SessionBudgetExceeded):guard.check_source()

    def test_storage_reports_stage_and_http_without_server_body(self):
        args=dict(owner=OWNER,identity='1234567890',record_id='source-1',kind='declaration',access_token=token(3600))
        for status in (401,403,500):
            with patch('declaration_documents.requests.post',return_value=Mock(status_code=status,json=lambda:{'secret':'PRIVATE'})),patch('declaration_documents.requests.get') as read:
                with self.assertRaises((SourceBlockedError,StorageResponseError)) as result:store_pdf(synthetic_pdf(),**args)
                self.assertEqual(result.exception.status,status)
                self.assertNotIn('PRIVATE',str(result.exception));read.assert_not_called()


class CollectorTests(unittest.IsolatedAsyncioTestCase):
    async def test_expiry_escapes_instead_of_marking_document_failed(self):
        with tempfile.TemporaryDirectory() as temp:
            collector=DocumentCollector(Path(temp),OWNER,token(10),lambda *a:None)
            with self.assertRaises(SessionBudgetExceeded):
                await collector.collect(SimpleNamespace(),[{'identity':'1234567890','recordId':'source-1'}])
            self.assertEqual(collector.failures,[])


class FailureTransportTests(transport_tests.TransportTests):
    async def test_original_status_retained_and_private_fields_never_logged(self):
        for status in (401,429,500):
            route=transport_tests.Route(self.query(),transport_tests.Response(status=status));await self.transport.handle(route)
            failure=self.transport.failure_for(route.request.url)
            self.assertEqual(failure.status,status);self.assertEqual(route.sent,1)
            if status in (401,429):self.assertIsInstance(failure,SourceBlockedError)
            text=(self.folder/'service-transport-errors.json').read_text()
            self.assertNotIn('SECRET_TOKEN',text);self.assertNotIn('1234567890',text)
            self.assertEqual(json.loads(text)[-1]['status'],status)


class DownloadFailureTests(unittest.IsolatedAsyncioTestCase):
    async def test_failed_response_finishes_promptly_and_preserves_cause(self):
        from declaration_document_adapter import download_one
        for status in (401,429,500):
            listeners={}
            context=SimpleNamespace(pages=[],on=lambda event,fn:listeners.update({event:fn}),remove_listener=lambda *a:None)
            response=SimpleNamespace(url='https://ebeyanname.gib.gov.tr/dispatch',status=status,headers={'content-type':'text/plain'},request=SimpleNamespace(method='GET'))
            async def click(**kwargs):listeners['response'](response)
            frame=SimpleNamespace(page=SimpleNamespace(context=context))
            with tempfile.TemporaryDirectory() as temp:
                with self.assertRaises((SourceBlockedError,ValueError)) as result:
                    await asyncio.wait_for(download_one(frame,SimpleNamespace(click=click),'declaration',Path(temp)),timeout=2)
                self.assertEqual(result.exception.status,status)


if __name__=='__main__':unittest.main()
