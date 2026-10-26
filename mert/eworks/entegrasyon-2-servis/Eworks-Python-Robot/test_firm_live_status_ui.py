"""Canlı durum renkleri: sahiplik, kaynak ayrımı, son kontrol ve bilinmeyen durum."""
import json,unittest
from datetime import datetime,timezone,timedelta
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright,expect
HTML=Path(__file__).resolve().parents[1]/'Eworks-Portal'/'eworks-tasarim.html'
OWNER='11111111-1111-4111-8111-111111111111'
class FirmLiveStatusUI(unittest.IsolatedAsyncioTestCase):
 async def test_live_statuses_and_unverified_are_distinct(self):
  now=datetime.now(timezone.utc);stamp=now.isoformat();before=(now-timedelta(hours=1)).isoformat()
  def check(kind,status='active',**extra):return dict(ownerId=OWNER,firmId='test-1',identity='1234567890',observedIdentity='1234567890',institution=kind,sourceType={'gib':'gib_live','sgk':'sgk_live','taxPlate':'tax_plate_live'}[kind],authorizationVerified=True,status=status,checkedAt=stamp,**extra)
  valid=check('sgk','inactive')
  firms=[dict(id='test-1',name='CANLI TEST FİRMA',taxNumber='1234567890',type='Limited',gibStatus='Kontrol edilmedi',liveInstitutionChecks=[valid]),dict(id='test-2',name='MANUEL TEST FİRMA',taxNumber='0987654321',type='Limited',gibStatus='Aktif',sgkStatus='Pasif',taxPlateStatus='Aktif',liveInstitutionChecks=[{**check('gib'), 'firmId':'test-2','identity':'0987654321','observedIdentity':'0987654321','ownerId':'wrong-owner'},{**check('taxPlate'),'firmId':'test-2','identity':'0987654321','observedIdentity':'different'}]),dict(id='test-3',name='SON KONTROL TEST',taxNumber='1111111111',type='Limited',liveInstitutionChecks=[{**check('gib','inactive'),'firmId':'test-3','identity':'1111111111','observedIdentity':'1111111111'},{**check('gib'),'firmId':'test-3','identity':'1111111111','observedIdentity':'1111111111','checkedAt':before}])]
  payload=dict(firms=firms,tasks=[],notes=[dict(id='witness',page='notices',sourceType='gib_notice_live',authorizationVerified=True,ownerId=OWNER,firmId='test-1',identity='1234567890')],institutionScopes={'test-1':dict(module='notices',ownerId=OWNER,firmId='test-1',identity='1234567890',observedAccountIdentity='1234567890',state='firm_account_verified',complete=True,importedAt=stamp)})
  async def route(r):
   path=urlsplit(r.request.url).path
   if path=='/eworks-tasarim.html':return await r.fulfill(body=HTML.read_text(encoding='utf-8'),content_type='text/html; charset=utf-8')
   if path in ('/demo-cleanup.js','/institution-review.js'):return await r.fulfill(body=HTML.with_name(path[1:]).read_text(encoding='utf-8'),content_type='application/javascript; charset=utf-8')
   if path=='/auth/v1/token':v=dict(access_token='synthetic',refresh_token='synthetic',expires_in=3600,user=dict(id=OWNER,email='test@example.invalid'))
   elif path=='/rest/v1/rpc/eworks_security_check':v=True
   elif path=='/rest/v1/eworks_state':v=[dict(revision=1,payload=payload)]
   else:return await r.abort()
   await r.fulfill(body=json.dumps(v),content_type='application/json')
  async with async_playwright() as p:
   browser=await p.chromium.launch(channel='chrome',headless=True)
   try:
    page=await browser.new_page(viewport=dict(width=1480,height=900));await page.route('**/*',route)
    await page.goto('http://127.0.0.1:8765/eworks-tasarim.html');await page.evaluate("()=>window.EworksLogin('test@example.invalid','synthetic')")
    rows=page.locator('.firm-table tbody tr');await expect(rows).to_have_count(3)
    chips=rows.nth(0).locator('.firm-status-chip')
    for i,state in enumerate(['active','inactive','unknown']):await expect(chips.nth(i)).to_have_attribute('data-live-status',state)
    await expect(chips.nth(0)).to_have_attribute('title',__import__('re').compile('GİB erişimi: Aktif'))
    self.assertEqual(await chips.nth(0).locator('b').evaluate('(e)=>getComputedStyle(e).backgroundColor'),'rgb(22, 134, 110)')
    self.assertEqual(await chips.nth(1).locator('b').evaluate('(e)=>getComputedStyle(e).backgroundColor'),'rgb(220, 53, 69)')
    await expect(rows.nth(1).locator('[data-live-status=unknown]')).to_have_count(3)
    await expect(rows.nth(2).locator('.firm-status-chip').nth(0)).to_have_attribute('data-live-status','inactive')
    await page.locator('.paper.table-card').screenshot(path=str(HTML.parents[3]/'firm-live-status-preview.png'))
   finally:await browser.close()
