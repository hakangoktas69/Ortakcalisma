"""Tamamen sentetik tarayıcı testi; gerçek portal ve Vault'a bağlanmaz."""
import json
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright, expect

HTML = Path(__file__).resolve().parents[1] / 'Eworks-Portal' / 'eworks-tasarim.html'
OWNER = '11111111-1111-4111-8111-111111111111'


class FirmAccountUI(unittest.IsolatedAsyncioTestCase):
    async def flow(self, legacy):
        saves = []
        async def route_request(route):
            path = urlsplit(route.request.url).path
            if path == '/eworks-tasarim.html':
                return await route.fulfill(body=HTML.read_text(encoding='utf-8'),content_type='text/html')
            if path == '/demo-cleanup.js':
                return await route.fulfill(body=HTML.with_name('demo-cleanup.js').read_text(encoding='utf-8'),content_type='application/javascript')
            if path == '/auth/v1/token':
                value = dict(access_token='synthetic',refresh_token='synthetic',expires_in=3600,user=dict(id=OWNER,email='test@example.invalid'))
            elif path == '/rest/v1/rpc/eworks_security_check':
                value = True
            elif path == '/rest/v1/eworks_state':
                value = [dict(revision=1,payload=dict(firms=[dict(id='TEST-FIRM',name='SENTETIK FIRMA',taxNumber='1234567890',type='Limited')],tasks=[]))]
            elif path == '/functions/v1/gib-account':
                body = json.loads(route.request.post_data)
                self.assertEqual(body['firmId'],'TEST-FIRM')
                if body['action']=='save': saves.append(body)
                value = dict(configured=body['action']=='save')
                if not legacy: value.update(scope='firm',firmId='TEST-FIRM')
            else:
                return await route.abort()
            await route.fulfill(body=json.dumps(value),content_type='application/json')
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            try:
                page = await browser.new_page()
                await page.route('**/*',route_request)
                await page.goto('http://127.0.0.1:8765/eworks-tasarim.html')
                await page.evaluate("() => window.EworksLogin('test@example.invalid','synthetic')")
                await page.get_by_role('button',name='Firma Kartı',exact=True).click()
                await page.get_by_role('button',name='Firma GİB Hesabı',exact=True).click()
                dialog = page.get_by_role('dialog',name='Firma GİB Hesabı',exact=True)
                button = dialog.get_by_role('button',name='Firma Hesabını Vault’a Kaydet')
                if legacy:
                    await expect(dialog.get_by_role('status')).to_contain_text('Kurulum gerekli')
                    await expect(button).to_be_disabled()
                    self.assertEqual(saves,[])
                else:
                    await expect(button).to_be_enabled()
                    await dialog.get_by_label('Firma GİB kullanıcı adı').fill('synthetic-user')
                    await dialog.get_by_label('Firma GİB şifresi').fill('synthetic-password')
                    await button.click()
                    await expect(dialog.get_by_role('status')).to_contain_text('Vault’a kaydedildi')
                    self.assertEqual(len(saves),1)
                    await expect(dialog.get_by_label('Firma GİB şifresi')).to_have_value('')
                    self.assertEqual(await page.evaluate('() => localStorage.length'),0)
            finally:
                await browser.close()

    async def test_legacy_function_cannot_save(self):
        await self.flow(True)

    async def test_scoped_save_clears_secret(self):
        await self.flow(False)
