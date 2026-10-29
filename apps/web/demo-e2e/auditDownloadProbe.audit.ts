import { test } from '@playwright/test';
import { girisYap } from '../e2e/yardim.ts';
test('indirme iptalinin kaynağını ayıran tanı', async ({ browser }, info) => {
 const results: unknown[] = [];
 for (const variant of ['normal', 'delayed-revoke', 'standalone', 'blank-origin']) {
  const context = await browser.newContext({ acceptDownloads: true, baseURL: 'http://localhost:8080' }); const page = await context.newPage();
  if (variant === 'delayed-revoke') await page.addInitScript(() => { const original = URL.revokeObjectURL.bind(URL); URL.revokeObjectURL = url => { setTimeout(() => original(url), 60000); }; });
  if (variant !== 'blank-origin') await girisYap(page, { eposta: 'demo@eworks.test', parola: process.env['DEMO_SIFRE'] ?? '' });
  if (variant !== 'blank-origin') await page.goto('/genel_bakis/takvim');
  const pending = page.waitForEvent('download');
  if (variant === 'standalone' || variant === 'blank-origin') await page.evaluate(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['DEMO diagnostic'], { type: 'text/csv' })); a.download = 'DEMO-probe.csv'; document.body.appendChild(a); a.click(); });
  else await page.getByRole('button', { name: 'Excel / CSV', exact: true }).click();
  const download = await pending; const failure = await download.failure();
  results.push({ variant, failure, filename: download.suggestedFilename() });
  await context.close();
 }
 console.log(JSON.stringify(results));
 await info.attach('indirme-tanisi', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
});
