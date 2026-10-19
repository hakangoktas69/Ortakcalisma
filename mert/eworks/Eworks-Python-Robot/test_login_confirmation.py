"""Sentetik sayfa: onaysız/boş CAPTCHA gönderilmez, onay sonrası tek tıklama."""
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from gib_automation import FIELDS, GibSelectors, solve_captcha_and_login


class LoginConfirmationTests(unittest.IsolatedAsyncioTestCase):
    async def run_case(self, approved, value):
        targets = {key: SimpleNamespace(fill=AsyncMock(), click=AsyncMock(),
                                       input_value=AsyncMock(return_value=value), wait_for=AsyncMock())
                   for key in ('#user', '#pass', '#image', '#captcha', '#login', '#home')}
        page = SimpleNamespace(url='https://dijital.gib.gov.tr/portal/login',
                               goto=AsyncMock(), locator=lambda key: targets[key])
        config = GibSelectors(username='#user', password='#pass', captcha_image='#image',
                              captcha_input='#captcha', login_button='#login', login_success='#home',
                              list_heading='#heading', table='#table', headers=FIELDS,
                              columns={field:i for i,field in enumerate(FIELDS)})
        confirm = AsyncMock(return_value=approved)
        result = await solve_captcha_and_login(page, 'SYNTHETIC', 'SYNTHETIC',
                                              '11111111-1111-4111-8111-111111111111',
                                              selectors=config, logger=MagicMock(), confirm_captcha=confirm)
        confirm.assert_awaited_once_with(page, '')
        return result, targets

    async def test_declined_confirmation_does_not_submit(self):
        result, targets = await self.run_case(False, 'MANUAL')
        self.assertFalse(result)
        targets['#login'].click.assert_not_awaited()

    async def test_blank_after_confirmation_does_not_submit(self):
        result, targets = await self.run_case(True, '   ')
        self.assertFalse(result)
        targets['#login'].click.assert_not_awaited()

    async def test_confirmed_input_is_submitted_once(self):
        result, targets = await self.run_case(True, 'MANUAL')
        self.assertTrue(result)
        targets['#login'].click.assert_awaited_once()
        targets['#home'].wait_for.assert_awaited_once_with(state='visible', timeout=60000)
