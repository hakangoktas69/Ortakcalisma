import json
import os
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright,expect

ROOT=Path(__file__).resolve().parents[1]/'Eworks-Portal'
OWNER='11111111-1111-4111-8111-111111111111'


class ReviewUITests(unittest.IsolatedAsyncioTestCase):
    async def test_review_saved_separately_and_idempotently(self,verified=False,sync=False):
        firm=dict(id='F1',name='SYNTHETIC',taxNumber='1234567890',contractStatus='Geçerli',
            contracts=[dict(number='T1',type='Aracılık ve Sorumluluk Sözleşmesi')])
        row=dict(identity='1234567890',recordId='source-1',document='KDV1',reference='source.xml',
            period='2026-06',date='2026-07-28',status='İptal',uploadMonth=7,metadata={'originalPeriod':'06/2026-06/2026'})
        batch=dict(schema='eworks.gib.review.v1',ownerId=OWNER,sourceJobId='a'*32,
            sourceOrigin='https://ebeyanname.gib.gov.tr',year=2026,uploadMonths=[7],
            reviewState='pending_authority',authorizationVerified=False,count=1,records=[row])
        commits=[];requested_scope=None
        firms=[firm]
        if sync:firms.append(dict(id='F2',name='SECOND SYNTHETIC',taxNumber='9876543210',contractStatus='Geçerli',contracts=[dict(number='T2',type='Aracılık ve Sorumluluk Sözleşmesi')]))
        if verified:
            batch.update(reviewState='verified_access',authorizationVerified=True,
                accessEvidence=dict(method='same_session_contract_and_scoped_query',identity='1234567890',
                    contractNumbers=['T1'],observedAt='2026-10-20T10:00:00+00:00'))
        async def route_request(route):
            nonlocal requested_scope
            path=urlsplit(route.request.url).path
            if path in ('/eworks-tasarim.html','/demo-cleanup.js','/institution-review.js'):
                file=ROOT/path.lstrip('/')
                return await route.fulfill(body=file.read_text(encoding='utf-8'),content_type='text/html; charset=utf-8' if path.endswith('html') else 'application/javascript; charset=utf-8')
            if path=='/auth/v1/token':result=dict(access_token='synthetic',refresh_token='synthetic',expires_in=3600,user=dict(id=OWNER,email='test@example.invalid'))
            elif path=='/auth/v1/user':result=dict(id=OWNER)
            elif path=='/rest/v1/rpc/eworks_security_check':result=True
            elif path=='/rest/v1/eworks_state':result=[dict(revision=1,payload=dict(firms=firms,tasks=[],notes=[]))]
            elif path=='/api/connection':result=dict(token='synthetic',ready=True)
            elif path=='/api/declarations/review':
                self.assertEqual(route.request.headers['authorization'],'Bearer synthetic')
                self.assertEqual(json.loads(route.request.post_data)['ownerId'],OWNER)
                result=batch
            elif path=='/api/declarations/sync':
                requested_scope=json.loads(route.request.post_data)['scope']
                self.assertEqual(requested_scope,dict(year=2026,identities=['1234567890','9876543210'],mode='upload',startDate='2026-07-01',endDate='2026-07-31'))
                self.assertEqual(route.request.headers['authorization'],'Bearer synthetic')
                result=dict(jobId='a'*32,state='queued')
            elif path=='/api/jobs/'+'a'*32:result=dict(state='completed',message='Sorgu tamamlandı')
            elif path=='/api/jobs/'+'a'*32+'/result':
                segment=dict(year=2026,month=7,startDate='2026-07-01',endDate='2026-07-31')
                first=dict(batch,uploadYearOnly=True,queryRange=dict(segment,mode='upload'))
                second=dict(first,count=0,records=[],accessEvidence=dict(first['accessEvidence'],identity='9876543210',contractNumbers=['T2']))
                result=dict(schema='eworks.declarations.sync.v1',requestId='a'*32,ownerId=OWNER,year=2026,
                    identities=requested_scope['identities'],months=[7],batches=[first,second],failures=[],completedScopes=2,totalScopes=2,queryScope=requested_scope,segments=[segment])
            elif path=='/rest/v1/rpc/eworks_commit':
                commits.append(json.loads(route.request.post_data));result=len(commits)+1
            else:return await route.abort()
            await route.fulfill(body=json.dumps(result),content_type='application/json')
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                page=await browser.new_page()
                await page.route('**/*',route_request)
                await page.goto('http://127.0.0.1:8765/eworks-tasarim.html')
                await page.locator('#username').fill('test@example.invalid')
                await page.locator('#password').fill('synthetic')
                await page.get_by_role('button',name='Giriş yap',exact=True).click()
                await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 1')
                await page.locator('[data-category="daily"]').click()
                await page.locator('[data-module="declarations"]').click()
                await page.locator('#contentView [data-nav="declarations-view"]').click()
                if sync:
                    await page.get_by_role('tab',name='Dönem Aralığı',exact=True).click()
                    await page.locator('[data-declaration-month="2026-06"]').click()
                    await page.locator('[data-declaration-month="2026-08"]').click()
                    await expect(page.locator('[data-declaration-month="2026-07"]')).to_have_attribute('aria-pressed','true')
                    await page.get_by_role('tab',name='Yükleme Zamanı',exact=True).click()
                    await page.locator('[data-declaration-month="2026-07"]').click()
                    await expect(page.locator('#declarationStartDate')).to_have_value('2026-07-01')
                    await expect(page.locator('#declarationEndDate')).to_have_value('2026-07-31')
                    await page.locator('#firmFilter').select_option('F1')
                    await expect(page.get_by_text('2 mükellef sorgulanacak · Firma filtresinden bağımsız',exact=True)).to_be_visible()
                if sync and os.environ.get('EWORKS_UI_SCREENSHOT'):
                    await page.evaluate('window.scrollTo(0,0)')
                    await page.screenshot(path=os.environ['EWORKS_UI_SCREENSHOT'],full_page=True,animations='disabled')
                    await page.set_viewport_size(dict(width=390,height=844))
                    await page.evaluate('window.scrollTo(0,0)')
                    await page.screenshot(path=os.environ['EWORKS_UI_SCREENSHOT'].replace('.png','-mobile.png'),full_page=True,animations='disabled')
                    self.assertTrue(await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
                    await page.set_viewport_size(dict(width=1280,height=720))
                button=page.get_by_role('button',name='Güncel e-Beyannameleri Çek' if sync else 'Son sorgu kayıtlarını yükle',exact=True)
                await button.click()
                if sync:await expect(page.locator('[data-declaration-captcha]')).to_have_count(0)
                await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 2')
                if verified:
                    self.assertEqual(commits[0]['p_payload']['institutionReviews'],[])
                    self.assertEqual(len(commits[0]['p_payload']['notes']),1)
                    self.assertTrue(commits[0]['p_payload']['notes'][0]['authorizationVerified'])
                    await expect(page.get_by_text('1 kayıt listeleniyor',exact=False)).to_be_visible()
                else:
                    self.assertEqual(len(commits[0]['p_payload']['institutionReviews']),1)
                    self.assertEqual(commits[0]['p_payload']['notes'],[])
                    self.assertEqual(commits[0]['p_payload']['institutionReviews'][0]['reviewState'],'pending_authority')
                    await expect(page.get_by_text('Kontrol bekleyen GİB kayıtları · 1',exact=True)).to_be_visible()
                if sync:await expect(button).to_be_enabled()
                await button.click()
                if sync:await expect(page.locator('[data-declaration-captcha]')).to_have_count(0)
                await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 3')
                self.assertEqual(len(commits[-1]['p_payload']['institutionReviews']),0 if verified else 1)
                self.assertEqual(len(commits[-1]['p_payload']['notes']),1 if verified else 0)
                if sync:
                    await expect(page.locator('#declarationSyncStatus')).to_contain_text('0 yeni beyanname kaydedildi · 1 mevcut kayıt tekrar eklenmedi')
            finally:await browser.close()

    async def test_verified_rows_enter_main_list_without_duplicates(self):
        await self.test_review_saved_separately_and_idempotently(verified=True)

    async def test_live_button_imports_then_skips_existing(self):
        await self.test_review_saved_separately_and_idempotently(verified=True,sync=True)
