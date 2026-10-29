import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { demoCatalog } from '../src/shared/demo/catalog.ts';
import { isAllowed, ROLE_TEMPLATES } from '@eworks/identity-access';
import { girisYap, hataTopla } from '../e2e/yardim.ts';
const specialized = new Set(['genel_bakis.panel', 'firmalar.liste', 'firmalar.kart', 'firmalar.kurum_hesaplari', 'genel_bakis.takvim', 'edefter.liste', 'kisayollar']);
for (const entry of demoCatalog(key => isAllowed(ROLE_TEMPLATES.ofis_admin, key)).filter(p => !specialized.has(p.key))) {
  test(`${entry.key} bütün demo işlem düğmeleri`, async ({ page, context }, info) => {
    const parola = process.env['DEMO_SIFRE']; if (!parola) throw new Error('Demo şifresi gerekli');
    await girisYap(page, { eposta: 'demo@eworks.test', parola });
    const errors = hataTopla(page); const unexpected: string[] = []; const covered: string[] = [];
    await context.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && (!['web', 'localhost', '127.0.0.1'].includes(url.hostname) || (url.pathname.startsWith('/api/') && request.method() !== 'GET'))) {
        unexpected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort();
      }
      return route.continue();
    });
    await page.goto(entry.path);
    await expect(page.getByText('DEMO · Tamamen kurgusal veriler', { exact: true })).toBeVisible();
    const actions = page.locator('[aria-label="Demo işlemleri"]');
    for (const action of entry.actions) {
      const kind = action.key.split('.').at(-1);
      await test.step(action.key, async () => {
        const button = actions.getByRole('button', { name: action.title, exact: true });
        await expect(button).toBeEnabled();
        if (kind === 'download' || kind === 'export') {
          const pending = page.waitForEvent('download'); await button.click(); const file = await pending;
          const path = await file.path(); if (!path) throw new Error('İndirme dosyası yok');
          expect(await readFile(path, 'utf8')).toContain('DEMO');
        } else if (['view', 'view_status', 'review'].includes(kind ?? '')) {
          await button.click(); await expect(page.getByRole('region', { name: 'Kayıt detayı', exact: true })).toBeVisible();
          await page.getByRole('button', { name: 'Detayı kapat', exact: true }).click();
        } else if (['create', 'edit', 'edit_credentials', 'edit_permissions', 'invite', 'ask', 'remind'].includes(kind ?? '')) {
          await button.click(); const form = page.getByRole('region', { name: 'Demo kayıt formu', exact: true });
          await expect(form).toBeVisible();
          await form.getByRole('textbox', { name: 'Açıklama', exact: true }).fill(`Demo denetim ${action.key}`);
          await form.getByRole('button', { name: 'Demo kaydını kaydet', exact: true }).click();
          await expect(page.getByRole('heading', { name: `Demo denetim ${action.key}`, exact: true })).toBeVisible();
        } else {
          await button.click();
          await expect(page.getByRole('status').filter({ hasText: kind === 'sync' || kind === 'start' ? 'Demo aktarımı tamamlandı' : 'demo olarak uygulandı' })).toBeVisible();
        }
        covered.push(action.key);
      });
    }
    await info.attach('denenen-demo-islemleri', { body: JSON.stringify({ page: entry.key, covered, unexpected, errors }, null, 2), contentType: 'application/json' });
    expect(unexpected).toEqual([]); expect(errors).toEqual([]);
  });
}
