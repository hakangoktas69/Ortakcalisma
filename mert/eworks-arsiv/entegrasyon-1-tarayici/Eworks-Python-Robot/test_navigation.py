"""Menü ve tüm kayıtları göster akışı; dış ağa çıkmayan sentetik test."""
import html
import json
import unittest
import asyncio
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock, patch

from playwright.async_api import async_playwright
from portal_worker import (TITLE, HEADERS, advance_navigation, discover,
                           footer_counts, prepare_list, visible_target, AmbiguousTarget, run)
from gib_automation import scrape_contract_table
from logger_service import LoggerService
from navigation_adapter import confirm_ivd_transition

OWNER = '11111111-1111-4111-8111-111111111111'


def action(label, content):
    script = 'document.body.innerHTML=' + json.dumps(content)
    return '<button onclick="' + html.escape(script, quote=True) + '">' + label + '</button>'


class FooterTests(unittest.TestCase):
    def test_counts_and_ambiguous_totals(self):
        self.assertEqual(footer_counts('1 - 274 listeleniyor. Toplam: 274'), (1, 274, 274))
        self.assertIsNone(footer_counts('Giriş yapın'))
        for text in ('1 - 20 listeleniyor. Toplam: 0',
                     '1 - 20 listeleniyor. Toplam: 274 1 - 20 listeleniyor. Toplam: 275'):
            with self.assertRaises(ValueError):
                footer_counts(text)


class NavigationTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_known_ivd_redirect_is_confirmed(self):
        message = ('İnternet Vergi Dairesi uygulamasına geçiş yapmak üzeresiniz. '
                   'Bu oturum üzerinden daha önce başlattığınız aktif İnternet Vergi Dairesi '
                   'oturumlarınız da sonlandırılacaktır. Onayınız sonrasında geçiş yapmak '
                   'istediğiniz uygulamaya yönlendirileceksiniz. Devam etmek istiyor musunuz?')
        panel = ('<div><h2>Yönlendirmeyi Onaylıyor Musunuz?</h2><p>'+message+'</p>'
                 '<button>İPTAL ET</button>'+action('ONAYLA', '<h1>Geçiş tamam</h1>')+'</div>')
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            try:
                context = await browser.new_context()
                await context.route('**/*', lambda r: r.fulfill(body='<meta charset="utf-8">', content_type='text/html'))
                page = await context.new_page()
                await page.goto('https://dijital.gib.gov.tr/portal')
                await page.set_content(panel)
                self.assertTrue(await confirm_ivd_transition(context))
                self.assertEqual(await page.locator('h1').inner_text(), 'Geçiş tamam')
                self.assertFalse(await confirm_ivd_transition(context))
                await page.set_content(panel.replace('İnternet Vergi Dairesi uygulamasına', 'Başka uygulamaya'))
                self.assertFalse(await confirm_ivd_transition(context))
                await page.set_content(panel+panel)
                with self.assertRaises(AmbiguousTarget):
                    await confirm_ivd_transition(context)
                await page.goto('https://example.invalid/')
                await page.set_content(panel)
                self.assertFalse(await confirm_ivd_transition(context))
            finally:
                await browser.close()

    async def test_count_error_keeps_session_open_until_explicit_cancel(self):
        header = '<tr>' + ''.join('<td>'+h+'</td>' for h in HEADERS) + '</tr>'
        fixture = '<h1>'+TITLE+'</h1><table>'+header+'</table>'
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            context = await browser.new_context()
            await context.route('**/*', lambda r: r.fulfill(body=fixture, content_type='text/html; charset=utf-8'))
            class Driver:
                async def __aenter__(self):
                    return SimpleNamespace(chromium=SimpleNamespace(launch=AsyncMock(return_value=browser)))
                async def __aexit__(self, *args):
                    return False
            with tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp)
                (folder/'request.json').write_text(json.dumps(dict(ownerId=OWNER, requestId='test')))
                with patch('portal_worker.async_playwright', return_value=Driver()), \
                     patch.object(browser, 'new_context', AsyncMock(return_value=context)), \
                     patch('portal_worker.prepare_list', AsyncMock(side_effect=ValueError('Sentetik sayım uyuşmazlığı'))):
                    task = asyncio.create_task(run(folder))
                    try:
                        for _ in range(100):
                            if (folder/'status.json').exists() and 'Sentetik' in (folder/'status.json').read_text(encoding='utf-8'):
                                break
                            await asyncio.sleep(.05)
                        status = json.loads((folder/'status.json').read_text(encoding='utf-8'))
                        self.assertEqual(status['state'], 'awaiting_user')
                        self.assertIn('Sentetik', status['message'])
                        self.assertFalse(task.done())
                        self.assertTrue(browser.is_connected())
                        self.assertTrue(context.pages)
                        (folder/'cancel').touch()
                        with self.assertRaisesRegex(ValueError, 'iptal'):
                            await asyncio.wait_for(task, 5)
                    finally:
                        if not task.done():
                            task.cancel()
                            await asyncio.gather(task, return_exceptions=True)
                        if browser.is_connected():
                            await browser.close()

    async def test_heading_is_not_menu_and_ambiguous_links_wait_for_manual_choice(self):
        label = 'İnternet Vergi Dairesi'
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            try:
                context = await browser.new_context()
                await context.route('**/*', lambda r: r.fulfill(body='<meta charset="utf-8">', content_type='text/html'))
                page = await context.new_page()
                await page.goto('https://gib.gov.tr/synthetic')
                await page.set_content('<h1>'+label+'</h1><a href="#one"><span>'+label+'</span></a>')
                target = await visible_target(context, label)
                self.assertEqual(await target.get_attribute('href'), '#one')
                await page.set_content('<h1>'+label+'</h1><div id="app" style="cursor:pointer"><span>🌐 '+label+'</span></div>')
                # React benzeri addEventListener kartı: onclick niteliği yoktur.
                await page.locator('#app').evaluate("el => el.addEventListener('click',()=>{el.dataset.clicked='yes'})")
                target = await visible_target(context, label)
                self.assertIsNotNone(target)
                await target.click()
                self.assertEqual(await page.locator('#app').get_attribute('data-clicked'), 'yes')
                await page.set_content('<p>'+label+'</p><section style="width:400px;overflow:hidden"><h2>Geçiş Yapılabilecek Uygulamalar</h2><div style="display:flex;width:1500px"><div id="card" style="width:300px;flex-shrink:0"><p>'+label+'</p></div><div style="margin-left:700px"><p>'+label+'</p></div></div></section>')
                await page.locator('#card').evaluate("el => el.addEventListener('click',()=>{el.dataset.clicked='yes'})")
                diagnostics = {}
                target = await visible_target(context, label, diagnostics)
                self.assertIsNotNone(target)
                self.assertEqual(diagnostics[label]['clickableCount'], 1)
                await target.click()
                self.assertEqual(await page.locator('#card').get_attribute('data-clicked'), 'yes')
                # Küçük pencerede kart aşağıda kalabilir; yatay karusel kopyası
                # hâlâ dışlanırken gerçek karta otomatik kaydırılmalıdır.
                await page.evaluate("window.scrollTo(0,0); document.querySelector('section').style.marginTop='1500px'")
                diagnostics = {}
                target = await visible_target(context, label, diagnostics)
                self.assertIsNotNone(target)
                self.assertEqual(diagnostics[label]['clickableCount'], 1)
                await target.click()
                self.assertEqual(await page.locator('#card').get_attribute('data-clicked'), 'yes')
                await page.set_content('<a href="#one">'+label+'</a><a href="#two">'+label+'</a>')
                with self.assertRaises(AmbiguousTarget):
                    await advance_navigation(context, set())
                self.assertFalse(page.is_closed())
                # Kullanıcı tek hedefe ilerledikten sonra aynı oturum devam edebilir.
                await page.set_content('<button>'+TITLE+'</button>')
                self.assertEqual(await advance_navigation(context, set()), TITLE)
            finally:
                await browser.close()

    async def test_menu_show_all_and_extract(self):
        header = '<tr>' + ''.join('<td>' + h + '</td>' for h in (*HEADERS, 'Görüntüle')) + '</tr>'
        def row(number):
            return '<tr>' + ''.join('<td>' + v + '</td>' for v in
                                   ('1234567890', '', 'SENTETIK', 'TEST', number,
                                    '', '', '', 'TEST', 'Görüntüle')) + '</tr>'
        complete = ('<h1>' + TITLE + '</h1><table>' + header + row('TEST-1') + row('TEST-2')
                    + '<tr><td colspan="10">1 - 2 listeleniyor. Toplam: 2</td></tr></table>')
        partial = ('<h1>' + TITLE + '</h1><table>' + header + row('TEST-1')
                   + '</table><p>1 - 1 listeleniyor. Toplam: 2</p>'
                   + action('Tümünü Göster', complete))
        fixture = action('İnternet Vergi Dairesi',
                         action('E-Beyanname Yetki Bilgileri', action(TITLE, partial)))
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel='chrome', headless=True)
            try:
                context = await browser.new_context()
                await context.route('**/*', lambda r: r.fulfill(body='<meta charset="utf-8">' + fixture,
                                                               content_type='text/html; charset=utf-8'))
                page = await context.new_page()
                await page.goto('https://gib.gov.tr/synthetic')
                visited = set()
                for label in ('İnternet Vergi Dairesi', 'E-Beyanname Yetki Bilgileri', TITLE):
                    self.assertEqual(await advance_navigation(context, visited), label)
                found = await discover(context)
                self.assertIsNotNone(found)
                frame, config = found
                # Canlı GİB alt bilgisinde bu kontrol, cursor:auto olan ve
                # olay dinleyicisiyle çalışan bir div olabilir.
                await page.get_by_role('button', name='Tümünü Göster', exact=True).evaluate('''el => {
                    const footer=document.createElement('section');
                    const count=document.createElement('span');count.textContent='1 - 1 listeleniyor. Toplam: 2';
                    const div=document.createElement('div');div.textContent=el.textContent;
                    div.addEventListener('click',el.onclick);div.hidden=true;
                    el.replaceWith(footer);footer.append(count,div);
                    setTimeout(()=>div.hidden=false,500);
                }''')
                # Gerçekte tablo, Tümünü Göster denetiminden önce yüklenebiliyor.
                total = await prepare_list(context, frame, config)
                self.assertEqual(total, 2)
                frame, config = await discover(context)
                rows = await scrape_contract_table(frame, OWNER, selectors=config,
                                                  expected_count=total, logger=LoggerService(MagicMock()))
                self.assertEqual([r['number'] for r in rows], ['TEST-1', 'TEST-2'])
                await page.goto('https://example.invalid/synthetic')
                self.assertIsNone(await advance_navigation(context, set()))
            finally:
                await browser.close()
