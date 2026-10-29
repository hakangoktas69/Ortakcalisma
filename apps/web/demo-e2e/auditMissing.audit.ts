import { expect, test } from '@playwright/test';
import { demoCatalog } from '../src/shared/demo/catalog.ts';
import { isAllowed, ROLE_TEMPLATES } from '@eworks/identity-access';
import { girisYap } from '../e2e/yardim.ts';
const checks = [
 ['/firmalar/kart', 'firmalar.kart', 'firmalar.kart.archive', 'Arşivle'],
 ['/firmalar/kurum_hesaplari', 'firmalar.kurum_hesaplari', 'firmalar.kurum_hesaplari.grant_use', 'Kullanım izni ver'],
 ['/firmalar/kurum_hesaplari', 'firmalar.kurum_hesaplari', 'firmalar.kurum_hesaplari.consent', 'Mükellef onayı'],
 ['/genel_bakis/takvim', 'genel_bakis.takvim', 'genel_bakis.takvim.sync', 'Takvimi kaynaklardan güncelle'],
] as const;
for (const [path, key, action, title] of checks) test(`${action} demo arayüzünde erişilebilir olmalı`, async ({ page }) => {
 const entry = demoCatalog(k => isAllowed(ROLE_TEMPLATES.ofis_admin, k)).find(p => p.key === key);
 expect(entry?.actions.some(a => a.key === action)).toBe(true);
 await girisYap(page, { eposta: 'demo@eworks.test', parola: process.env['DEMO_SIFRE'] ?? '' });
 await page.goto(path); await expect(page.locator('[data-demo-page]')).toHaveAttribute('data-demo-page', key);
 if (key.startsWith('firmalar.')) await page.getByRole('button', { name: /mükellef bilgilerini düzenle/ }).first().click();
 await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible({ timeout: 1500 });
});
