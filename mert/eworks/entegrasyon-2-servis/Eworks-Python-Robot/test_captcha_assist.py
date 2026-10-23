"""Sentetik sayfa; canlı GİB veya gerçek CAPTCHA kullanılmaz."""
import asyncio
import unittest
from unittest.mock import patch
from playwright.async_api import async_playwright
from captcha_assist import CaptchaAssist


class AssistTests(unittest.IsolatedAsyncioTestCase):
    async def test_configured_ocr_is_detected_outside_robot_directory(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            interpreter=Path(directory)/'python.exe'
            interpreter.touch()
            with patch.dict('os.environ',{'EWORKS_OCR_PYTHON':str(interpreter)}), patch('captcha_assist.read_local_suggestion',return_value='AB7X2') as neural, patch('captcha_assist.read_captcha_suggestion',return_value=''):
                await CaptchaAssist().suggest(self.page)
                neural.assert_called_once()
                self.assertEqual(await self.page.locator('#code').input_value(),'AB7X2')

    async def asyncSetUp(self):
        self.local_patch = patch('captcha_assist.read_local_suggestion', return_value='')
        self.local_patch.start()
        self.addCleanup(self.local_patch.stop)
        self.pw = await async_playwright().start()
        self.browser = await self.pw.chromium.launch(channel='chrome', headless=True)
        self.page = await self.browser.new_page()
        await self.page.route('https://dijital.gib.gov.tr/**', lambda r: r.fulfill(
            content_type='text/html; charset=utf-8', body='''<label for="code">Güvenlik kodu</label>
            <input id="code"><canvas id="captcha" width="150" height="50"></canvas>
            <button onclick="window.submitted=true">Giriş Yap</button>'''))
        await self.page.goto('https://dijital.gib.gov.tr/portal/login')

    async def asyncTearDown(self):
        await self.browser.close()
        await self.pw.stop()

    async def test_fills_but_never_submits_and_does_not_refill_same_image(self):
        assist = CaptchaAssist()
        with patch('captcha_assist.read_captcha_suggestion', return_value='AB7X2') as ocr:
            self.assertTrue(await assist.suggest(self.page))
            self.assertEqual(await self.page.locator('#code').input_value(), 'AB7X2')
            self.assertFalse(await self.page.evaluate('!!window.submitted'))
            await self.page.locator('#code').fill('')
            assist.next_check = 0
            self.assertEqual(await assist.suggest(self.page), '')
            self.assertEqual(ocr.call_count, 1)

    async def test_preserves_user_input(self):
        await self.page.locator('#code').fill('MANUAL')
        with patch('captcha_assist.read_captcha_suggestion') as ocr:
            await CaptchaAssist().suggest(self.page)
            ocr.assert_not_called()
        self.assertEqual(await self.page.locator('#code').input_value(), 'MANUAL')

    async def test_auto_login_clicks_once_even_when_login_stays_open(self):
        await self.page.evaluate("""() => {
            document.body.insertAdjacentHTML('beforeend', '<input type="password" value="synthetic">');
            document.querySelector('button').onclick = () => window.clicks = (window.clicks || 0) + 1;
        }""")
        assist = CaptchaAssist(auto_login=True)
        with patch('captcha_assist.read_captcha_suggestion', return_value='AB7X2'):
            self.assertIn('düğmesine basıldı', await assist.suggest(self.page))
            self.assertEqual(await self.page.evaluate('window.clicks'), 1)
            await self.page.locator('#code').fill('')
            assist.next_check = 0
            await assist.suggest(self.page)
            self.assertEqual(await self.page.evaluate('window.clicks'), 1)

    async def test_auto_login_does_not_submit_without_account_password(self):
        with patch('captcha_assist.read_captcha_suggestion', return_value='AB7X2'):
            self.assertIn('hazır değil', await CaptchaAssist(auto_login=True).suggest(self.page))
            self.assertFalse(await self.page.evaluate('!!window.submitted'))

    async def test_preserves_input_entered_during_ocr(self):
        started = asyncio.Event()
        release = asyncio.Event()
        async def delayed(*args, **kwargs):
            started.set()
            await release.wait()
            return 'AB7X2'
        with patch('captcha_assist.asyncio.to_thread', side_effect=delayed):
            task = asyncio.create_task(CaptchaAssist().suggest(self.page))
            await asyncio.wait_for(started.wait(), 10)
            await self.page.locator('#code').fill('MANUAL')
            release.set()
            self.assertEqual(await task, '')
        self.assertEqual(await self.page.locator('#code').input_value(), 'MANUAL')

    async def test_ambiguous_images_are_not_read(self):
        await self.page.evaluate("document.body.insertAdjacentHTML('beforeend','<canvas id=\"captcha2\"></canvas>')")
        with patch('captcha_assist.read_captcha_suggestion') as ocr:
            self.assertIn('görseli tanınamadı', await CaptchaAssist().suggest(self.page))
            ocr.assert_not_called()

    async def test_other_sites_are_not_read(self):
        await self.page.route('https://example.invalid/**', lambda r: r.fulfill(body='<input>'))
        await self.page.goto('https://example.invalid/')
        with patch('captcha_assist.read_captcha_suggestion') as ocr:
            self.assertEqual(await CaptchaAssist().suggest(self.page), '')
            ocr.assert_not_called()


if __name__ == '__main__':
    unittest.main()
