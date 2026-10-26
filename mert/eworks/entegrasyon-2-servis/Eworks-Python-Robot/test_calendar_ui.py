"""Takvim testleri tamamen sentetik oturumda, ağ erişimi engellenerek çalışır."""
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright, expect

HTML=Path(__file__).resolve().parents[1]/'Eworks-Portal'/'eworks-tasarim.html'
OWNER='11111111-1111-4111-8111-111111111111'


class CalendarUI(unittest.IsolatedAsyncioTestCase):
    async def test_views_filters_and_reminder_persistence(self):
        commits=[]
        async def route(r):
            path=urlsplit(r.request.url).path
            if path=='/eworks-tasarim.html':return await r.fulfill(body=HTML.read_text(encoding='utf-8'),content_type='text/html; charset=utf-8')
            if path in ('/demo-cleanup.js','/institution-review.js'):return await r.fulfill(body=HTML.with_name(path[1:]).read_text(encoding='utf-8'),content_type='application/javascript; charset=utf-8')
            if path=='/auth/v1/token':value=dict(access_token='synthetic',refresh_token='synthetic',expires_in=3600,user=dict(id=OWNER,email='test@example.invalid'))
            elif path=='/rest/v1/rpc/eworks_security_check':value=True
            elif path=='/rest/v1/eworks_state':value=[dict(revision=1,payload=dict(firms=[dict(id='calendar-fixture',name='SENTETİK TAKVİM FİRMASI',type='Limited')],tasks=[dict(id='kept-task',title='Eski görev korunur',firm='Ofis',due='2026-10-26',owner='Ofis',status='Bekliyor')],notes=[]))]
            elif path=='/rest/v1/rpc/eworks_commit':commits.append(json.loads(r.request.post_data));value=len(commits)+1
            else:return await r.abort()
            await r.fulfill(body=json.dumps(value),content_type='application/json')
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                page=await browser.new_page(viewport=dict(width=1480,height=1080))
                await page.clock.install(time=datetime(2026,10,26,9,tzinfo=timezone.utc))
                await page.route('**/*',route)
                await page.goto('http://127.0.0.1:8765/eworks-tasarim.html')
                await page.evaluate("()=>window.EworksLogin('test@example.invalid','synthetic')")
                await page.locator('#calendarToggle').click()
                await expect(page.locator('.calendar-grid [role=gridcell]')).to_have_count(42)
                await expect(page.locator('.calendar-grid .calendar-day-number[data-calendar-day="2026-10-26"]')).to_be_visible()
                self.assertGreater(await page.locator('.calendar-grid [data-calendar-event^="gib-"]').count(),0)
                await page.locator('[data-calendar-source="gib"]').uncheck()
                await expect(page.locator('.calendar-grid [data-calendar-event^="gib-"]')).to_have_count(0)
                await page.locator('[data-calendar-source="gib"]').check()
                await page.locator('.calendar-grid .calendar-day-number[data-calendar-day="2026-10-28"]').click()
                await expect(page.locator('#drawerBody')).to_contain_text('Günün etkinlikleri')
                await page.locator('#drawerBody [data-calendar-event^="gib-"]').first.click()
                await expect(page.locator('#drawerBody')).to_contain_text('Vergi Takvimi (GİB)')
                await page.locator('#drawerBody [data-calendar-remind]').click()
                await expect(page.locator('#calendarTaskForm [name=due]')).to_have_value('2026-10-28')
                self.assertFalse(commits)
                await page.locator('#drawerBody [data-close]').first.click()
                await page.get_by_role('button',name='Haftalık',exact=True).click()
                await expect(page.locator('.calendar-agenda')).to_be_visible()
                await page.get_by_role('button',name='Yıllık',exact=True).click()
                await expect(page.locator('.calendar-year-month')).to_have_count(12)
                await page.get_by_role('button',name='Aylık',exact=True).click()
                await page.get_by_role('button',name='Hatırlatma Ekle',exact=True).click()
                form=page.locator('#calendarTaskForm')
                await form.get_by_label('Başlık',exact=True).fill('Sentetik e-imza yenileme')
                await form.get_by_label('Tarih',exact=True).fill('2026-10-27')
                await form.get_by_label('Kategori',exact=True).select_option('signature')
                await form.get_by_label('Hatırlatma',exact=True).select_option('7')
                await form.get_by_label('Mükellef',exact=True).select_option(label='SENTETİK TAKVİM FİRMASI')
                await form.get_by_label('Not',exact=True).fill('SENTETİK KAYIT')
                await form.get_by_role('button',name='Kaydet',exact=True).click()
                await expect(page.locator('#cloudStatus')).to_contain_text('Sürüm 2')
                tasks=commits[0]['p_payload']['tasks']
                self.assertEqual(len(tasks),2)
                new=next(t for t in tasks if t['id']!='kept-task')
                self.assertEqual((new['due'],new['reminderDays'],new['category']),('2026-10-27',7,'signature'))
                await expect(page.locator('.calendar-grid [data-calendar-event="task-'+new['id']+'"]')).to_be_visible()
                await page.locator('[data-calendar-category="signature"]').uncheck()
                await expect(page.locator('.calendar-grid [data-calendar-event="task-'+new['id']+'"]')).to_have_count(0)
                await page.locator('[data-calendar-category="signature"]').check()
                await page.evaluate('window.scrollTo(0,0)')
                await page.screenshot(path=str(Path(__file__).resolve().parents[4]/'work'/'calendar-preview.png'),full_page=True)
                await page.set_viewport_size(dict(width=390,height=844))
                self.assertTrue(await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
                await page.get_by_role('button',name='Liste',exact=True).click()
                await expect(page.locator('.calendar-agenda')).to_contain_text('Sentetik e-imza yenileme')
            finally:await browser.close()

