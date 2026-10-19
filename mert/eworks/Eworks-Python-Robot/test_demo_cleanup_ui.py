"""Demo temizliği ve geri alma: gerçek ağa bağlanmadan portal entegrasyon testi."""
import json
import unittest
from urllib.parse import urlsplit
from playwright.async_api import async_playwright, expect
from test_portal_ui import HTML, OWNER


class DemoCleanupUITest(unittest.IsolatedAsyncioTestCase):
    async def test_cleanup_and_restore(self):
        firm = dict(id='real', name='GERCEK KAYIT TESTI', taxNumber='1234567890',
                    sourceType='gib_live', contracts=[dict(number='C-1')])
        note = dict(id='sim-1', page='declarations', sourceType='simulation', title='TEST')
        commits = []

        async def handle(route):
            path = urlsplit(route.request.url).path
            if path == '/eworks-tasarim.html':
                return await route.fulfill(body=HTML.read_text(encoding='utf-8'), content_type='text/html')
            if path == '/demo-cleanup.js':
                return await route.fulfill(body=HTML.with_name('demo-cleanup.js').read_text(encoding='utf-8'), content_type='application/javascript')
            if path == '/auth/v1/token':
                value = dict(access_token='synthetic', expires_in=3600, user=dict(id=OWNER))
            elif path == '/rest/v1/rpc/eworks_security_check':
                value = True
            elif path == '/rest/v1/eworks_state':
                value = [dict(revision=5, payload=dict(firms=[firm], tasks=[], notes=[note]))]
            elif path == '/rest/v1/rpc/eworks_commit':
                commits.append(json.loads(route.request.post_data))
                value = 5 + len(commits)
            else:
                return await route.abort()
            await route.fulfill(body=json.dumps(value), content_type='application/json')

        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            try:
                page = await browser.new_page(viewport=dict(width=1440, height=1000))
                await page.route('**/*', handle)
                await page.goto('http://127.0.0.1:8765/eworks-tasarim.html')
                await page.locator('#username').fill('test@example.invalid')
                await page.locator('#password').fill('synthetic')
                await page.get_by_role('button', name='Giriş yap', exact=True).click()
                await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 6')
                self.assertEqual(commits[0]['p_action'], 'demo_data_cleanup')
                payload = commits[0]['p_payload']
                self.assertEqual(payload['firms'], [firm])
                self.assertEqual(payload['notes'], [])
                self.assertEqual(payload['demoCleanup']['removed']['notes'], [note])
                await expect(page.locator('#notifyToggle .red-dot')).to_be_hidden()
                await expect(page.get_by_role('button', name='GİB Simülasyonu Oluştur')).to_have_count(0)
                # Navigate through the existing UI; modules are exposed in global search.
                await page.locator('#globalSearchInput').fill('e-Defter')
                await page.locator('#searchPop [data-nav="ledger"]').click()
                await expect(page.locator('#contentView')).to_contain_text('Kontrol edilmedi')
                await expect(page.locator('#contentView')).not_to_contain_text('Onaylandı')
                await page.locator('#globalSearchInput').fill('Portal Kullanımı')
                await page.locator('#searchPop [data-nav="settings-install"]').click()
                await page.locator('[data-demo-undo]').click()
                await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 7')
                self.assertEqual(commits[1]['p_action'], 'demo_cleanup_restored')
                self.assertEqual(commits[1]['p_payload']['firms'], [firm])
                self.assertEqual(commits[1]['p_payload']['notes'], [note])
            finally:
                await browser.close()
