"""Sentetik hesap; gerçek GİB/Supabase bağlantısı veya gizli veri kullanılmaz."""
import unittest
from unittest.mock import MagicMock, patch
from playwright.async_api import async_playwright
from cloud_credentials import fetch_credentials, fill_gib_credentials, verify_owner

OWNER = '11111111-1111-4111-8111-111111111111'


class CredentialAPITests(unittest.TestCase):
    def test_owner_mismatch_and_redirect_rejected_without_leaking_response(self):
        response = MagicMock(status_code=200)
        response.json.return_value = dict(ownerId='other', username='SYNTHETIC', password='SECRET-TEST')
        with patch('cloud_credentials.requests.post', return_value=response) as post:
            with self.assertRaises(ValueError) as error:
                fetch_credentials('synthetic', OWNER)
            self.assertNotIn('SECRET-TEST', str(error.exception))
            self.assertFalse(post.call_args.kwargs['allow_redirects'])
            response.status_code = 302
            with self.assertRaises(ValueError):
                fetch_credentials('synthetic', OWNER)

    def test_user_is_verified_by_supabase(self):
        response = MagicMock(status_code=200)
        response.json.return_value = dict(id=OWNER)
        with patch('cloud_credentials.requests.get', return_value=response):
            self.assertTrue(verify_owner('synthetic', OWNER))
            self.assertFalse(verify_owner('synthetic', '22222222-2222-4222-8222-222222222222'))
        self.assertFalse(verify_owner('', OWNER))


class CredentialFormTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_official_login_filled_and_captcha_is_left_to_user(self):
        fixture = '''<label for="user">T.C. Kimlik No / Vergi Kimlik No / Kullanıcı Kodu</label>
          <input id="user"><label for="pass">Şifre</label><input id="pass" type="password">
          <label for="captcha">Doğrulama Kodu</label><input id="captcha">'''
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            try:
                page = await browser.new_page()
                await page.route('**/*', lambda r: r.fulfill(body=fixture, content_type='text/html; charset=utf-8'))
                credentials = dict(username='SYNTHETIC', password='SECRET-TEST')
                await page.goto('https://example.invalid/portal/login')
                self.assertFalse(await fill_gib_credentials(page, credentials))
                await page.goto('https://dijital.gib.gov.tr/portal/login')
                self.assertTrue(await fill_gib_credentials(page, credentials))
                self.assertEqual(credentials, {})
                self.assertEqual(await page.locator('#user').input_value(), 'SYNTHETIC')
                self.assertEqual(await page.locator('#pass').input_value(), 'SECRET-TEST')
                self.assertEqual(await page.locator('#captcha').input_value(), '')
            finally:
                await browser.close()
