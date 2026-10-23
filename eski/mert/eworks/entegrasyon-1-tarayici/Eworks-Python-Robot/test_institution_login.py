import unittest
from unittest.mock import patch
from institution_login import EdefterOAuthAssist, official_login_kind
from playwright.async_api import async_playwright


class LoginScopeTests(unittest.TestCase):
    def test_only_observed_official_application_paths(self):
        self.assertEqual(official_login_kind('https://dijital.gib.gov.tr/portal/oauth?state=synthetic','ledgers'),'edefter_oauth')
        for url,module in [('https://dijital.gib.gov.tr.evil.invalid/portal/oauth','ledgers'),
                           ('https://dijital.gib.gov.tr/portal/oauth','declarations'),
                           ('https://user:password@dijital.gib.gov.tr/portal/oauth','ledgers')]:
            self.assertIsNone(official_login_kind(url,module))


class OAuthTests(unittest.IsolatedAsyncioTestCase):
    async def test_identity_provider_error_is_not_login_success(self):
        from institution_login import application_access_failure
        html='<h1>We are sorry...</h1><p>User 1234567890 authenticated with identity provider dijital does not exist. Please contact your administrator.</p><a href="#" onclick="window.followed=true">Back to Application</a>'
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                page=await browser.new_page()
                await page.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                await page.goto('https://authebelge.gib.gov.tr/synthetic')
                state=await application_access_failure(page)
                self.assertEqual(state,'identity_provider_account_missing')
                self.assertNotIn('1234567890',state)
                self.assertIsNone(await page.evaluate('window.followed'))
                await page.goto('https://authebelge.gib.gov.tr.evil.invalid/synthetic')
                self.assertIsNone(await application_access_failure(page))
            finally:
                await browser.close()

    async def flow(self,manual=False,wrong_account=False,marker=True):
        html='''<p>e-Defter Uygulaması</p><span>e-Defter Uygulaması</span><input aria-label="T.C. Kimlik No / Vergi Kimlik No / Kullanıcı Kodu">
        <input type="password"><input aria-label="Doğrulama Kodu"><img alt="captchaImg" src="data:image/png;base64,AA==">
        <button onclick="window.submissions=(window.submissions||0)+1">Giriş Yap</button>'''
        if not marker: html=html.replace('e-Defter Uygulaması','Başka Uygulama')
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                page=await browser.new_page()
                await page.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                await page.goto('https://dijital.gib.gov.tr/portal/oauth?state=synthetic')
                if manual: await page.get_by_role('textbox',name='Doğrulama Kodu').fill('HUMAN')
                if wrong_account: await page.get_by_role('textbox',name='T.C. Kimlik No / Vergi Kimlik No / Kullanıcı Kodu').fill('OTHER')
                async def pixels(_): return b'synthetic-image'
                helper=EdefterOAuthAssist()
                with patch('institution_login.image_content',pixels),patch('institution_login.read_local_suggestion',return_value='TEST12'):
                    state=await helper.submit_once(page,dict(username='synthetic',password='synthetic'))
                    await helper.submit_once(page,dict(username='synthetic',password='synthetic'))
                count=await page.evaluate('window.submissions||0')
                if manual:
                    self.assertEqual(state,'manual_input_present');self.assertEqual(count,0)
                    self.assertEqual(await page.get_by_role('textbox',name='Doğrulama Kodu').input_value(),'HUMAN')
                elif wrong_account:
                    self.assertEqual(state,'account_mismatch');self.assertEqual(count,0)
                elif not marker:
                    self.assertEqual(state,'application_unverified');self.assertEqual(count,0)
                else:
                    self.assertEqual(state,'submitted');self.assertEqual(count,1)
            finally:
                await browser.close()

    async def test_single_submission(self): await self.flow()
    async def test_preserves_manual_code(self): await self.flow(manual=True)
    async def test_wrong_account_rejected(self): await self.flow(wrong_account=True)
    async def test_wrong_application_rejected(self): await self.flow(marker=False)
