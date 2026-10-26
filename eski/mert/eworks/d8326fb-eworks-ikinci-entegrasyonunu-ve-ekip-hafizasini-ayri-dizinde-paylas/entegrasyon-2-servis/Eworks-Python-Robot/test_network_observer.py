import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from playwright.async_api import async_playwright
from network_observer import NetworkObserver,request_schema,endpoint,MAX_BODY

SECRET='PRIVATE_SENTINEL_9d4c7f2a'

def req(**values):
    return SimpleNamespace(**dict(dict(url='https://dijital.gib.gov.tr/apigateway/auth/tdvd/login?token='+SECRET,
        method='POST',resource_type='xhr',headers={'content-type':'application/json','authorization':SECRET,'cookie':SECRET},
        post_data=json.dumps(dict(userid=SECRET,sifre=SECRET,dk=SECRET,imageId=SECRET))),**values))


class SchemaTests(unittest.TestCase):
    def test_login_does_not_retain_values_or_dynamic_field_names(self):
        r=req(post_data=json.dumps({'sifre':SECRET,SECRET:{'token':SECRET},'data':{'result':SECRET}}))
        text=json.dumps(request_schema(r))
        self.assertNotIn(SECRET,text)
        self.assertIn('sifre',text);self.assertIn('authorization',text)
        self.assertIn('unlistedCount',text)

    def test_form_and_query_keep_names_not_values(self):
        d=request_schema(req(url='https://ebeyanname.gib.gov.tr/dispatch?TOKEN='+SECRET+'&cmd='+SECRET,
            headers={'content-type':'application/x-www-form-urlencoded'},post_data='vergiNo='+SECRET+'&cmd='+SECRET))
        self.assertEqual(d['bodyFields']['names'],['cmd','vergiNo'])
        self.assertNotIn(SECRET,json.dumps(d))

    def test_only_official_exact_origins_and_safe_paths(self):
        for url in ['http://ebeyanname.gib.gov.tr/dispatch','https://gib.gov.tr.evil.test/dispatch',
                    'https://user:pass@ebeyanname.gib.gov.tr/dispatch','https://ebeyanname.gib.gov.tr:444/dispatch']:
            self.assertIsNone(endpoint(url))
        self.assertNotIn(SECRET,json.dumps(endpoint('https://dijital.gib.gov.tr/'+SECRET)))
        self.assertEqual(endpoint('https://ebeyanname.gib.gov.tr/dispatch')['path'],'/dispatch')

    def test_binary_assets_and_large_or_malformed_bodies_are_not_copied(self):
        self.assertIsNone(request_schema(req(resource_type='image')))
        for body in [SECRET,SECRET*(MAX_BODY//len(SECRET)+1)]:
            self.assertNotIn(SECRET,json.dumps(request_schema(req(post_data=body))))


class ObserverTests(unittest.IsolatedAsyncioTestCase):
    async def test_response_shape_never_saves_tokens_messages_or_cookie_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            obs=NetworkObserver(Path(tmp));r=req();obs.on_request(r)
            raw=json.dumps({'token':SECRET,'messages':[SECRET],'result':{'data':SECRET},SECRET:SECRET}).encode()
            response=SimpleNamespace(request=r,status=200,headers={'content-type':'application/json','content-length':str(len(raw)),'set-cookie':SECRET},body=AsyncMock(return_value=raw))
            await obs.inspect_response(response)
            saved=(Path(tmp)/'network-schema.json').read_text()
            self.assertNotIn(SECRET,saved)
            self.assertIn('bodyShape',saved);self.assertIn('token',saved)

    async def test_unknown_length_large_json_and_pdf_contents_are_not_read(self):
        with tempfile.TemporaryDirectory() as tmp:
            obs=NetworkObserver(Path(tmp))
            for headers in [{'content-type':'application/json'},
                            {'content-type':'application/json','content-length':str(MAX_BODY+1)},
                            {'content-type':'application/pdf','content-length':'100'}]:
                r=req();obs.on_request(r)
                response=SimpleNamespace(request=r,status=200,headers=headers,body=AsyncMock(return_value=SECRET.encode()))
                await obs.inspect_response(response);response.body.assert_not_awaited()

    async def test_record_cap_and_write_failure_do_not_break_requests(self):
        with tempfile.TemporaryDirectory() as tmp:
            obs=NetworkObserver(Path(tmp)/'missing',max_records=2)
            for _ in range(5):obs.on_request(req())
            self.assertEqual(len(obs.records),2);self.assertEqual(obs.dropped,3)
            await obs.close()

    async def test_real_browser_events_with_fixtures_and_zero_live_gib_requests(self):
        with tempfile.TemporaryDirectory() as tmp:
            async with async_playwright() as p:
                browser=await p.chromium.launch(channel='chrome',headless=True)
                context=await browser.new_context()
                async def fixture(route):
                    if route.request.url.split('?')[0].endswith('/portal/login'):
                        await route.fulfill(status=200,content_type='text/html',body='<html><body>Fixture</body></html>')
                    else:
                        raw=json.dumps({'token':SECRET,'result':True}).encode()
                        await route.fulfill(status=200,headers={'content-type':'application/json','content-length':str(len(raw))},body=raw)
                await context.route('**/*',fixture)
                obs=NetworkObserver(Path(tmp));obs.attach(context)
                page=await context.new_page()
                await page.goto('https://dijital.gib.gov.tr/portal/login')
                await page.evaluate('''async secret=>{await fetch('/apigateway/auth/tdvd/login',{
                    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userid:secret,sifre:secret,dk:secret,imageId:secret})});}''',SECRET)
                await obs.close()
                saved=(Path(tmp)/'network-schema.json').read_text()
                self.assertNotIn(SECRET,saved)
                records=json.loads(saved)['records']
                login=next(r for r in records if r['path']=='/apigateway/auth/tdvd/login')
                self.assertEqual(login['method'],'POST');self.assertEqual(login['response']['status'],200)
                self.assertEqual(set(login['bodyShape']['fields']),{'userid','sifre','dk','imageId'})
                await browser.close()


if __name__=='__main__':unittest.main()
