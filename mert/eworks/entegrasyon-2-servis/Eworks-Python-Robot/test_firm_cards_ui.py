import json, unittest
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright, expect
HTML=Path(__file__).resolve().parents[1]/'Eworks-Portal'/'eworks-tasarim.html'
class FirmCardsUI(unittest.IsolatedAsyncioTestCase):
 async def test_save_and_mobile(self):
  commits=[]; errors=[]
  firm=dict(id='TEST-FIRM',name='ÖRNEK TEST FİRMASI',taxNumber='1234567890',type='Limited',contractNumber='TEST-CONTRACT',eLedgerStatus='Kontrol edilmedi',contracts=[dict(number='TEST-CONTRACT')])
  async def route(r):
   path=urlsplit(r.request.url).path
   if path=='/eworks-tasarim.html':return await r.fulfill(body=HTML.read_text(encoding='utf-8'),content_type='text/html; charset=utf-8')
   if path in ('/demo-cleanup.js','/institution-review.js'):return await r.fulfill(body=HTML.with_name(path[1:]).read_text(encoding='utf-8'),content_type='application/javascript; charset=utf-8')
   if path=='/auth/v1/token':v=dict(access_token='synthetic',refresh_token='synthetic',expires_in=3600,user=dict(id='11111111-1111-4111-8111-111111111111',email='test@example.invalid'))
   elif path=='/rest/v1/rpc/eworks_security_check':v=True
   elif path=='/rest/v1/eworks_state':v=[dict(revision=1,payload=dict(firms=[firm],tasks=[],notes=[]))]
   elif path=='/rest/v1/rpc/eworks_commit':commits.append(json.loads(r.request.post_data));v=len(commits)+1
   else:return await r.abort()
   await r.fulfill(body=json.dumps(v),content_type='application/json')
  async with async_playwright() as p:
   browser=await p.chromium.launch(channel='chrome',headless=True)
   try:
    page=await browser.new_page(viewport=dict(width=1480,height=1100));page.on('pageerror',lambda e:errors.append(str(e)))
    await page.route('**/*',route);await page.goto('http://127.0.0.1:8765/eworks-tasarim.html')
    await page.evaluate("()=>window.EworksLogin('test@example.invalid','synthetic')")
    await page.get_by_role('button',name='Düzenle',exact=True).click()
    await expect(page.locator('.firm-account-card')).to_have_count(8)
    await expect(page.locator('#firmForm input[type=password],#firmForm [name=contractNumber],#firmForm [name=eLedgerStatus]')).to_have_count(0)
    await page.get_by_label('SGK kullanıcı adı',exact=True).fill('test-user')
    await page.get_by_label('İşyeri kodu',exact=True).fill('2')
    await page.get_by_label('UETS adresi',exact=True).fill('test-uets')
    await page.get_by_label('Portal kullanıcı adı',exact=True).fill('test-portal')
    await page.locator('.firm-account-grid').screenshot(path=str(HTML.parents[3]/'firm-account-cards-preview.png'))
    await page.set_viewport_size(dict(width=390,height=844))
    self.assertTrue(await page.locator('#drawerBody').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
    await page.locator('#firmForm').get_by_role('button',name='Kaydet',exact=True).click()
    await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 2')
    saved=commits[0]['p_payload']['firms'][0]
    for key,val in dict(sgkUser='test-user',uetsAddress='test-uets',portalUser='test-portal',contractNumber='TEST-CONTRACT',contracts=firm['contracts'],eLedgerStatus='Kontrol edilmedi').items():self.assertEqual(saved[key],val)
    await page.get_by_role('button',name='Düzenle',exact=True).click()
    await expect(page.get_by_label('Portal kullanıcı adı',exact=True)).to_have_value('test-portal')
    self.assertEqual(errors,[])
   finally:await browser.close()
