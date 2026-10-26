import json
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright, expect

HTML=Path(__file__).resolve().parents[1]/'Eworks-Portal'/'eworks-tasarim.html'
OWNER='11111111-1111-4111-8111-111111111111'

class PortalUI(unittest.IsolatedAsyncioTestCase):
 async def test_firm_edit_and_daily_scope(self):
  requests=[]; saves=[]
  async def route(r):
   path=urlsplit(r.request.url).path
   if path=='/eworks-tasarim.html':return await r.fulfill(body=HTML.read_text(encoding='utf-8'),content_type='text/html')
   if path=='/demo-cleanup.js':return await r.fulfill(body=HTML.with_name('demo-cleanup.js').read_text(encoding='utf-8'),content_type='application/javascript')
   if path=='/institution-review.js':return await r.fulfill(body=HTML.with_name('institution-review.js').read_text(encoding='utf-8'),content_type='application/javascript')
   if path=='/auth/v1/token':value=dict(access_token='synthetic',refresh_token='synthetic',expires_in=3600,user=dict(id=OWNER,email='test@example.invalid'))
   elif path=='/rest/v1/rpc/eworks_security_check':value=True
   elif path=='/rest/v1/eworks_state':value=[dict(revision=1,payload=dict(firms=[dict(id='fixture-1',name='SENTETİK FİRMA BİR',taxNumber='1234567890',type='Limited',contracts=[dict(number='synthetic-contract')]),dict(id='fixture-2',name='SENTETİK FİRMA İKİ',identityNumber='12345678901',type='Şahıs')],tasks=[]))]
   elif path=='/rest/v1/rpc/eworks_commit':
    saves.append(json.loads(r.request.post_data));value=2
   elif path=='/api/connection':value=dict(ready=True,token='synthetic-local')
   elif path=='/api/portal/open':
    requests.append(json.loads(r.request.post_data));value=dict(jobId='synthetic-job',state='queued')
   elif path=='/api/jobs/synthetic-job':value=dict(state='failed',message='Sentetik test: canlı giriş yapılmadı.')
   else:return await r.abort()
   await r.fulfill(body=json.dumps(value),content_type='application/json')
  async with async_playwright() as p:
   browser=await p.chromium.launch(channel='chrome',headless=True)
   try:
    page=await browser.new_page(viewport=dict(width=1400,height=1000));await page.route('**/*',route)
    await page.goto('http://127.0.0.1:8765/eworks-tasarim.html');await page.evaluate("()=>window.EworksLogin('test@example.invalid','synthetic')")
    await expect(page.get_by_role('button',name='Firma Kartı',exact=True)).to_have_count(0)
    await page.get_by_role('button',name='Düzenle',exact=True).first.click()
    await expect(page.locator('#firmForm')).to_be_visible()
    await expect(page.locator('#drawerBody')).to_contain_text('Temel Bilgiler')
    await expect(page.locator('#drawerBody')).not_to_contain_text('Portal Kısayolları')
    await expect(page.get_by_role('textbox',name='Ünvan',exact=True)).to_have_value('SENTETİK FİRMA BİR')
    await expect(page.get_by_role('textbox',name='TC / VKN',exact=True)).to_have_value('1234567890')
    await page.get_by_role('textbox',name='Vergi Dairesi',exact=True).fill('SENTETİK VERGİ DAİRESİ')
    out=Path(__file__).resolve().parents[4]/'work'/'firm-edit-preview.png'
    await page.screenshot(path=str(out))
    await page.locator('#firmForm').get_by_role('button',name='Kaydet',exact=True).click()
    await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 2')
    updated=next(f for f in saves[0]['p_payload']['firms'] if f['id']=='fixture-1')
    self.assertEqual(updated['taxOffice'],'SENTETİK VERGİ DAİRESİ')
    self.assertEqual(updated['contracts'],[dict(number='synthetic-contract')])
    await page.locator('#contentView [data-category="daily"]').click()
    await page.locator('#contentView [data-nav="portal-entries"]').click()
    await expect(page.get_by_role('button',name='Mükellef Portalını Aç',exact=True).first).to_be_disabled()
    await page.locator('#portalFirmSelect').select_option('fixture-2')
    await page.locator('[data-openportal="digital"]').click()
    await expect(page.locator('#portalSessionStatus')).to_contain_text('Sentetik test')
    self.assertEqual(requests,[dict(ownerId=OWNER,portalSession=dict(firmId='fixture-2',identity='12345678901',target='digital'))])
    await page.locator('[data-portaltab="sgk"]').click()
    await expect(page.locator('#contentView')).to_contain_text('otomatik giriş henüz bağlı değil')
    await page.locator('[data-portaltab="gib"]').click()
    out=Path(__file__).resolve().parents[4]/'work'/'portal-test.png'
    # Test screenshot is private and contains only synthetic firms.
    await page.screenshot(path=str(out),full_page=True)
    await page.set_viewport_size(dict(width=390,height=844))
    self.assertTrue(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   finally:await browser.close()
