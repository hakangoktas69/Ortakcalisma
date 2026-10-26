"""Canlı yazma, Türkçe eşleşme, unvan sıralaması ve imleç korunması."""
import json
import unittest
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright, expect

HTML=Path(__file__).resolve().parents[1]/'Eworks-Portal'/'eworks-tasarim.html'
OWNER='11111111-1111-4111-8111-111111111111'


class FirmSearchUI(unittest.IsolatedAsyncioTestCase):
    async def test_live_title_search_preserves_focus_and_cursor(self):
        errors=[]
        firms=[dict(id='fixture-1',name='MAVİ LOJİSTİK TEST',type='Limited'),
               dict(id='fixture-2',name='LOJİSTİK DENEME',type='Limited'),
               dict(id='fixture-3',name='İĞDE İNŞAAT TEST',type='Limited',taxNumber='1234567890')]
        async def route(r):
            path=urlsplit(r.request.url).path
            if path=='/eworks-tasarim.html':return await r.fulfill(body=HTML.read_text(encoding='utf-8'),content_type='text/html; charset=utf-8')
            if path in ('/demo-cleanup.js','/institution-review.js'):return await r.fulfill(body=HTML.with_name(path[1:]).read_text(encoding='utf-8'),content_type='application/javascript; charset=utf-8')
            if path=='/auth/v1/token':value=dict(access_token='synthetic',refresh_token='synthetic',expires_in=3600,user=dict(id=OWNER,email='test@example.invalid'))
            elif path=='/rest/v1/rpc/eworks_security_check':value=True
            elif path=='/rest/v1/eworks_state':value=[dict(revision=1,payload=dict(firms=firms,tasks=[]))]
            else:return await r.abort()
            await r.fulfill(body=json.dumps(value),content_type='application/json')
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                page=await browser.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
                await page.route('**/*',route)
                await page.goto('http://127.0.0.1:8765/eworks-tasarim.html')
                await page.evaluate("()=>window.EworksLogin('test@example.invalid','synthetic')")
                search=page.locator('#innerSearch')
                await search.press_sequentially('igde insaat',delay=15)
                await expect(page.locator('.firm-table tbody tr')).to_have_count(1)
                await expect(page.locator('.firm-table tbody')).to_contain_text('İĞDE İNŞAAT TEST')
                await expect(search).to_be_focused()
                await expect(search).to_have_value('igde insaat')
                await search.press('Home');await search.press('X')
                await expect(search).to_have_value('Xigde insaat')
                self.assertEqual(await search.evaluate('(el)=>el.selectionStart'),1)
                await search.fill('lojistik')
                await expect(page.locator('.firm-table tbody tr')).to_have_count(2)
                await expect(page.locator('.firm-table tbody tr').first).to_contain_text('LOJİSTİK DENEME')
                await search.fill('1234567890')
                await expect(page.locator('.firm-table tbody tr')).to_have_count(1)
                await expect(page.locator('.firm-table tbody')).to_contain_text('İĞDE İNŞAAT TEST')
                await search.fill('')
                await expect(page.locator('.firm-table tbody tr')).to_have_count(3)
                self.assertEqual(errors,[])
            finally:await browser.close()
