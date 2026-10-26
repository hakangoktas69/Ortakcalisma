import json
import tempfile
import unittest
from pathlib import Path
from playwright.async_api import async_playwright
from network_probe import query_once
from declaration_reader import HEADERS


class ProbeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.p=await async_playwright().start()
        self.browser=await self.p.chromium.launch(channel='chrome',headless=True)
        self.context=await self.browser.new_context()
        self.page=await self.context.new_page()
        self.tmp=tempfile.TemporaryDirectory();self.folder=Path(self.tmp.name)

    async def asyncTearDown(self):
        await self.browser.close();await self.p.stop();self.tmp.cleanup()

    async def fixture(self,*,start_day=15,extra_filter=False,alert=False):
        fields=''.join(f'<input type="checkbox" name="{n}" '+('checked' if extra_filter and n=='sorguTipiN' else '')+'>' for n in ('sorguTipiN','sorguTipiT','sorguTipiB','sorguTipiP','sorguTipiV','sorguTipiD'))
        fields+='<input name="sorguTipiZ" type="checkbox" checked>'
        for prefix,day in [('baslangic',start_day),('bitis',22)]:
            for suffix,value in [('Yil',2026),('Ay',10),('Gun',day)]:fields+=f'<input name="{prefix}Tarihi{suffix}" value="{value}">'
        table='<table><tr>'+''.join('<th>'+x+'</th>' for x in HEADERS)+'</tr><tr>'+''.join('<td>fixture</td>' for _ in HEADERS)+'</tr></table><table><tr><td>1 - 1 / 1</td><td><input title="Sonraki Sayfa" disabled></td></tr></table>'
        action="alert('fixture warning')" if alert else 'document.querySelector("#result").innerHTML='+json.dumps(table)
        html='<html><body>'+fields+'<input name="sorgulaButon" type="button" onclick="taxReturnSearchFormPost()"><div id="result"></div><script>window.calls=0;function taxReturnSearchFormPost(){window.calls++;'+action+';}</script></body></html>'
        await self.context.route('**/*',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
        await self.page.goto('https://ebeyanname.gib.gov.tr/dispatch')

    async def test_one_query_returns_only_aggregate_summary(self):
        await self.fixture()
        result=await query_once(self.page.main_frame,self.folder,lambda *args:None)
        self.assertEqual(result['queryCount'],1);self.assertEqual(result['totalRows'],1)
        self.assertEqual(await self.page.evaluate('window.calls'),1)
        self.assertNotIn('fixture',json.dumps(result))

    async def test_extra_filter_and_wide_dates_never_send_query(self):
        await self.fixture(extra_filter=True)
        with self.assertRaises(ValueError):await query_once(self.page.main_frame,self.folder,lambda *args:None)
        self.assertEqual(await self.page.evaluate('window.calls'),0)
        await self.context.unroute('**/*')
        await self.fixture(start_day=1)
        with self.assertRaises(ValueError):await query_once(self.page.main_frame,self.folder,lambda *args:None)
        self.assertEqual(await self.page.evaluate('window.calls'),0)

    async def test_warning_is_not_an_empty_success(self):
        await self.fixture(alert=True)
        with self.assertRaisesRegex(ValueError,'boş kabul edilmedi'):
            await query_once(self.page.main_frame,self.folder,lambda *args:None)

    async def test_second_transport_requires_identical_rows_not_only_count(self):
        from unittest.mock import patch
        await self.fixture()
        state={'closed':False,'queries':0,'mismatch':False}
        class FakeService:
            def __init__(self,*args):self.payload={};self.error=False
            def capture(self,request):pass
            async def query(self):
                state['queries']+=1
                return {'records':[{'id':'','cells':['different' if state['mismatch'] else 'fixture']*10}],
                    'totalRows':1,'hasMorePages':False}
            def close(self):state['closed']=True
        with patch('declaration_service.DeclarationService',FakeService):
            result=await query_once(self.page.main_frame,self.folder,lambda *args:None,verify_service=True)
            self.assertTrue(result['serviceVerified']);self.assertEqual(result['serviceQueryCount'],1)
            self.assertTrue(state['closed']);self.assertNotIn('fixture',json.dumps(result))
            state['mismatch']=True;state['closed']=False
            with self.assertRaisesRegex(ValueError,'eşleşmedi'):
                await query_once(self.page.main_frame,self.folder,lambda *args:None,verify_service=True)
            self.assertTrue(state['closed'])

    async def test_portal_connection_test_does_not_commit_or_start_bulk_transfer(self):
        from urllib.parse import urlsplit
        from playwright.async_api import expect
        root=Path(__file__).resolve().parents[1]/'Eworks-Portal'
        owner='11111111-1111-4111-8111-111111111111';calls=[]
        async def handler(route):
            path=urlsplit(route.request.url).path;calls.append(path)
            if path in ['/eworks-tasarim.html','/demo-cleanup.js','/institution-review.js']:
                return await route.fulfill(body=(root/path[1:]).read_text(encoding='utf-8'),content_type='text/html' if path.endswith('.html') else 'application/javascript')
            if path=='/auth/v1/token':result=dict(access_token='synthetic',refresh_token='synthetic',expires_in=3600,user={'id':owner})
            elif path=='/auth/v1/user':result={'id':owner}
            elif path=='/rest/v1/rpc/eworks_security_check':result=True
            elif path=='/rest/v1/eworks_state':result=[dict(revision=51,payload={'firms':[],'tasks':[],'notes':[]})]
            elif path=='/functions/v1/gib-account':result={'configured':True}
            elif path=='/api/connection':result={'ready':True,'token':'synthetic'}
            elif path=='/api/gib/network-probe':result={'jobId':'probe-fixture'}
            elif path=='/api/jobs/probe-fixture':result={'state':'completed','message':'Fixture'}
            elif path=='/api/jobs/probe-fixture/result':result=dict(schema='eworks.gib.network-probe.v1',ownerId=owner,requestId='probe-fixture',queryCount=1,totalRows=8)
            else:return await route.abort()
            await route.fulfill(content_type='application/json',body=json.dumps(result))
        await self.context.route('**/*',handler)
        await self.page.goto('http://127.0.0.1:8765/eworks-tasarim.html')
        await self.page.locator('#username').fill('test@example.invalid')
        await self.page.locator('#password').fill('synthetic')
        await self.page.get_by_role('button',name='Giriş yap',exact=True).click()
        await expect(self.page.locator('#cloudStatus')).to_contain_text('Sürüm 51')
        await self.page.locator('[data-category="daily"]').click()
        await self.page.locator('[data-module="declarations"]').click()
        await self.page.locator('#contentView [data-nav="declarations-view"]').click()
        await self.page.get_by_role('button',name='GİB bağlantısını test et',exact=True).click()
        await expect(self.page.locator('#declarationSyncStatus')).to_contain_text('1 sorgu · 8 sonuç')
        self.assertEqual(calls.count('/api/gib/network-probe'),1)
        self.assertNotIn('/rest/v1/rpc/eworks_commit',calls)
        self.assertNotIn('/api/declarations/sync',calls)


if __name__=='__main__':unittest.main()
