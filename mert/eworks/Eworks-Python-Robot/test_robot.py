"""Yalnızca sentetik veri; Supabase ve canlı GİB'e istek göndermez."""
import unittest
from unittest.mock import MagicMock

from playwright.async_api import async_playwright

from gib_automation import FIELDS, GibSelectors, scrape_contract_table, validate_contracts
from logger_service import LoggerService
from main_orchestrator import save_contracts_to_supabase
from portal_worker import discover, HEADERS

OWNER = "11111111-1111-4111-8111-111111111111"


def sample(number="TEST-1"):
    row = dict.fromkeys(FIELDS, "")
    row.update(taxNumber="1234567890", name="SENTETIK TEST", number=number, musavir_id=OWNER)
    return row


class ContractTests(unittest.TestCase):
    def test_missing_duplicate_and_wrong_owner_rejected(self):
        invalid = [[], [sample(), sample()], [dict(sample(), musavir_id="other")],
                   [dict(sample(), taxNumber="bad")], [dict(sample(), number="")]]
        for records in invalid:
            with self.subTest(records=len(records)), self.assertRaises(ValueError):
                validate_contracts(records, max(1, len(records)), OWNER)

    def test_upsert_preserves_tenant_and_contract_key(self):
        client = MagicMock()
        count = save_contracts_to_supabase([sample(), sample("TEST-2")], OWNER,
                                         expected_count=2, logger=LoggerService(client))
        self.assertEqual(count, 2)
        call = client.table.return_value.upsert.call_args
        self.assertEqual(call.kwargs["on_conflict"], "musavir_id,mukellef_vkn_tckn,sozlesme_no")
        self.assertTrue(all(r["musavir_id"] == OWNER for r in call.args[0]))

    def test_partial_list_never_writes(self):
        client = MagicMock()
        with self.assertRaises(ValueError):
            save_contracts_to_supabase([sample()], OWNER, expected_count=2,
                                      logger=LoggerService(client))
        client.table.assert_not_called()

    def test_database_failure_is_not_success(self):
        client = MagicMock()
        client.table.return_value.upsert.return_value.execute.side_effect = RuntimeError("test")
        with self.assertRaises(RuntimeError):
            save_contracts_to_supabase([sample()], OWNER, expected_count=1,
                                      logger=LoggerService(client))


class BrowserFixtureTests(unittest.IsolatedAsyncioTestCase):
    async def test_discover_observed_td_header_table(self):
        header=''.join('<td>'+h+'</td>' for h in HEADERS)
        cells=''.join('<td>'+sample()[key]+'</td>' for key in FIELDS)
        fixture='<meta charset="utf-8"><h1>Geçerli E-Beyanname Sözleşmeleri Listesi</h1><table><tr>'+header+'</tr><tr>'+cells+'</tr></table>'
        async with async_playwright() as p:
            browser=await p.chromium.launch(channel='chrome',headless=True)
            try:
                context=await browser.new_context()
                await context.route('**/*',lambda route:route.fulfill(body=fixture,content_type='text/html; charset=utf-8'))
                page=await context.new_page()
                await page.goto('https://gib.gov.tr/fixture')
                found=await discover(context)
                self.assertIsNotNone(found)
                frame,config=found
                rows=await scrape_contract_table(frame,OWNER,selectors=config,expected_count=1,logger=LoggerService(MagicMock()))
                self.assertEqual(rows[0]['number'],'TEST-1')
                with_action = fixture.replace('</tr>', '<td>Görüntüle</td></tr>')
                await page.set_content(with_action)
                found = await discover(context)
                self.assertIsNotNone(found)
                frame, config = found
                rows = await scrape_contract_table(frame, OWNER, selectors=config,
                                                  expected_count=1, logger=LoggerService(MagicMock()))
                self.assertEqual(rows[0]['number'], 'TEST-1')
                self.assertEqual(len(rows[0]), 10)  # dokuz alan ve sahip UUID'si
                await page.set_content(with_action.replace('Görüntüle', 'Bilinmeyen sütun'))
                self.assertIsNone(await discover(context))
                await page.set_content(fixture.replace('Mükellef Vergi Kimlik Numarası','Unknown header'))
                self.assertIsNone(await discover(context))
            finally:
                await browser.close()

    async def test_two_pages_and_header_change(self):
        config = GibSelectors(
            username="#user", password="#pass", captcha_image="#image",
            captcha_input="#captcha", login_button="#login", login_success="#home",
            list_heading="#heading", table="#contracts", headers=FIELDS,
            columns={field: i for i, field in enumerate(FIELDS)}, next_button="#next",
        )
        headers = "".join(f"<th>{field}</th>" for field in FIELDS)
        values = [sample()[key] for key in FIELDS]
        cells = "".join(f"<td>{value}</td>" for value in values)
        fixture = (
            '<meta charset="utf-8"><h1 id="heading">Geçerli E-Beyanname Sözleşmeleri Listesi</h1>'
            f'<table id="contracts"><thead><tr>{headers}</tr></thead>'
            f'<tbody><tr>{cells}</tr></tbody></table>'
            '<button id="next" onclick="document.querySelectorAll(\'#contracts td\')[4].textContent=\'TEST-2\';this.disabled=true">Next</button>'
        )
        async with async_playwright() as p:
            browser = await p.chromium.launch(channel="chrome", headless=True)
            try:
                page = await browser.new_page()
                # Tüm ağ istekleri yerel fixture ile karşılanır; dış bağlantı yoktur.
                await page.route("**/*", lambda route: route.fulfill(body=fixture, content_type="text/html; charset=utf-8"))
                await page.goto("https://gib.gov.tr/test-fixture")
                logger = LoggerService(MagicMock())
                records = await scrape_contract_table(page, OWNER, selectors=config,
                                                      expected_count=2, logger=logger)
                self.assertEqual([r["number"] for r in records], ["TEST-1", "TEST-2"])
                await page.set_content(fixture.replace("<th>taxNumber</th>", "<th>changed</th>"))
                with self.assertRaises(ValueError):
                    await scrape_contract_table(page, OWNER, selectors=config,
                                                expected_count=1, logger=logger)
            finally:
                await browser.close()


if __name__ == "__main__":
    unittest.main()
