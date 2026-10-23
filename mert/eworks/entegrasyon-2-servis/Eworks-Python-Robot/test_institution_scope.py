import unittest
from playwright.async_api import async_playwright
from institution_scope import observe_readonly_account_identity


class AccountScopeTests(unittest.IsolatedAsyncioTestCase):
    async def observe(self,html):
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=html,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://dijital.gib.gov.tr/synthetic')
                return await observe_readonly_account_identity(page)
            finally:
                await browser.close()

    async def test_visible_header_identity_is_observed(self):
        result=await self.observe('<header><span>VKN: 1234567890</span></header>')
        self.assertEqual(result['identity'],'1234567890')

    async def test_readonly_dvd_profile_popup_identity(self):
        from institution_scope import notice_account_scope
        result=await self.observe('<div aria-haspopup="true"><p>SENTETİK HESAP</p><p>1234567890</p></div>')
        self.assertEqual(result['identity'],'1234567890')
        self.assertEqual(notice_account_scope(result,'9999999999')['state'],'account_target_mismatch')
        self.assertFalse(notice_account_scope(result,'9999999999')['canImport'])
        self.assertTrue(notice_account_scope(result,'1234567890')['canImport'])

    async def test_profile_like_query_and_grid_cannot_prove_account(self):
        result=await self.observe('<form><div aria-haspopup="true">SYNTHETIC 1234567890</div></form><div role="grid"><div aria-haspopup="true">SYNTHETIC 1234567890</div></div>')
        self.assertIsNone(result['identity'])

    def test_advisor_account_need_not_equal_target_taxpayer(self):
        from institution_scope import notice_account_scope
        account=dict(state='readonly_identity_observed',identity='9999999999')
        pending=notice_account_scope(account,'1234567890',access_mode='advisor')
        self.assertEqual(pending['state'],'advisor_taxpayer_scope_required')
        self.assertFalse(pending['canImport'])
        verified=notice_account_scope(account,'1234567890',access_mode='advisor',
            observed_taxpayer_identity='1234567890',authorized_identities={'1234567890'})
        self.assertTrue(verified['canImport'])
        self.assertFalse(notice_account_scope(account,'1234567890',access_mode='advisor',
            observed_taxpayer_identity='0000000000',authorized_identities={'1234567890'})['canImport'])

    async def test_query_values_and_taxpayer_rows_are_not_account_identity(self):
        result=await self.observe('<header><form><span>VKN: 1234567890</span><input value="1234567890"></form></header><table><tr><td>VKN: 9999999999</td></tr></table>')
        self.assertIsNone(result['identity'])

    async def test_hidden_and_ambiguous_identity_is_rejected(self):
        result=await self.observe('<header><span hidden>VKN: 1234567890</span></header>')
        self.assertIsNone(result['identity'])
        result=await self.observe('<header><span>VKN: 1234567890</span><span>VKN: 9999999999</span></header>')
        self.assertEqual(result['state'],'ambiguous_identity')
