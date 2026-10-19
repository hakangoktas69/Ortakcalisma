"""Portal -> robot -> RPC zinciri; bütün ağ istekleri sentetik yanıtlanır."""
import json
import unittest
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright, expect

OWNER = '11111111-1111-4111-8111-111111111111'
HTML = Path(__file__).resolve().parents[1] / 'Eworks-Portal' / 'eworks-tasarim.html'


class PortalUITests(unittest.IsolatedAsyncioTestCase):
    async def run_flow(self, fail_save=False):
        continued = False
        commits = []
        saved_accounts = []
        batch = dict(schema='eworks.gib.contracts.v1', sourceType='gib_live',
                     source='Sentetik test', exportedAt='2026-10-16T12:00:00Z',
                     count=1, requestId='test-job', ownerId=OWNER,
                     contracts=[dict(taxNumber='1234567890', identityNumber='',
                                     name='SENTETIK TEST', taxOffice='TEST', number='TEST-1',
                                     date='', service='', registeredAt='', type='TEST')])

        async def route_request(route):
            nonlocal continued
            path = urlsplit(route.request.url).path
            status = 200
            if path == '/eworks-tasarim.html':
                return await route.fulfill(body=HTML.read_text(encoding='utf-8'),
                                           content_type='text/html; charset=utf-8')
            if path == '/demo-cleanup.js':
                return await route.fulfill(body=HTML.with_name('demo-cleanup.js').read_text(encoding='utf-8'),
                                           content_type='application/javascript; charset=utf-8')
            if path == '/auth/v1/token':
                result = dict(access_token='synthetic', refresh_token='synthetic',
                              expires_in=3600, user=dict(id=OWNER, email='test@example.invalid'))
            elif path == '/rest/v1/rpc/eworks_security_check':
                result = True
            elif path == '/rest/v1/eworks_state':
                result = [dict(revision=3, payload=dict(firms=[], tasks=[]))]
            elif path == '/functions/v1/gib-account':
                account = json.loads(route.request.post_data)
                self.assertIn(account['action'], ('status', 'save'))
                if account['action'] == 'save':
                    saved_accounts.append(account)
                result = dict(configured=True)
            elif path == '/api/connection':
                result = dict(ready=True, mode='python', token='synthetic')
            elif path == '/api/gib/update':
                self.assertEqual(json.loads(route.request.post_data)['ownerId'], OWNER)
                result = dict(jobId='test-job')
            elif path == '/api/jobs/test-job/continue':
                self.assertEqual(json.loads(route.request.post_data)['expectedCount'], 1)
                continued = True
                result = dict(message='Sentetik liste okunuyor')
            elif path == '/api/jobs/test-job':
                result = dict(state='completed' if continued else 'awaiting_user',
                              message='Sentetik liste hazır')
            elif path == '/api/jobs/test-job/result':
                result = batch
            elif path == '/rest/v1/rpc/eworks_commit':
                commits.append(json.loads(route.request.post_data))
                status, result = (503, dict(message='Sentetik kayıt hatası')) if fail_save else (200, 4)
            else:
                return await route.abort()
            await route.fulfill(status=status, body=json.dumps(result),
                                content_type='application/json')

        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            try:
                page = await browser.new_page()
                await page.route('**/*', route_request)
                await page.goto('http://127.0.0.1:8765/eworks-tasarim.html')
                await page.locator('#username').fill('test@example.invalid')
                await page.locator('#password').fill('synthetic-password')
                await page.get_by_role('button', name='Giriş yap', exact=True).click()
                await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 3')
                if not fail_save:
                    await page.locator('[data-gib-account]').click()
                    await page.locator('[name=gibUsername]').fill('SYNTHETIC-USER')
                    await page.locator('[name=gibPassword]').fill('SYNTHETIC-GIB-PASSWORD')
                    await page.get_by_role('button', name='Supabase’e Şifreli Kaydet').click()
                    await expect(page.locator('#gibAccountStatus')).to_contain_text('Vault’a kaydedildi')
                    self.assertEqual(await page.locator('[name=gibPassword]').input_value(), '')
                    self.assertEqual(saved_accounts[0]['username'], 'SYNTHETIC-USER')
                    await page.locator('[data-gib-account-close]').click()
                await page.get_by_role('button', name='Bilgileri Güncelle', exact=True).click()
                await expect(page.locator('[data-gib-continue]')).to_be_visible()
                await page.locator('#gibExpectedCount').fill('1')
                await page.locator('[data-gib-continue]').click()
                expected = 'kayıt doğrulanamadı' if fail_save else '1 sözleşme Supabase’e kaydedildi.'
                await expect(page.locator('#gibSyncStatus')).to_contain_text(expected, timeout=10000)
                self.assertEqual(len(commits), 1)
                self.assertEqual(commits[0]['p_expected_revision'], 3)
                self.assertEqual(commits[0]['p_payload']['firms'][0]['contractNumber'], 'TEST-1')
                self.assertNotIn('SYNTHETIC-GIB-PASSWORD', json.dumps(commits))
                if fail_save:
                    await expect(page.locator('#cloudFailure')).to_be_visible()
            finally:
                await browser.close()

    async def test_complete_flow_waits_for_database(self):
        await self.run_flow()

    async def test_failed_database_is_not_reported_as_saved(self):
        await self.run_flow(fail_save=True)
