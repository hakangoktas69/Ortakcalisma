import { expect, test } from '@playwright/test';
import { girisYap, ekranDenetle, hataTopla } from '../e2e/yardim.ts';
test.beforeEach(async ({ page }) => {
  const parola = process.env['DEMO_SIFRE']; if (!parola) throw new Error('Demo şifresi gerekli');
  await girisYap(page, { eposta: 'demo@eworks.test', parola });
});
test('ortak ekranların tablo, sayaç ve sağ panel tasarımı dört boyutta çalışır', async ({ page }, info) => {
  const errors = hataTopla(page); const writes: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(r.url()); });
  for (const path of ['/beyanname/liste', '/sgk/ebildirge', '/tebligat/liste', '/odeme/aylik_liste']) {
    await page.goto(path); await expect(page.locator('.demo-reference')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Kayıt özeti' }).locator('article')).toHaveCount(4);
    await expect(page.locator('.dr-records .demo-record')).toHaveCount(9);
    await ekranDenetle(page); await page.screenshot({ path: info.outputPath(path.split('/')[1] + '-liste.png'), fullPage: true });
    await page.locator('.dr-records').getByRole('button', { name: /detay$/i }).first().click();
    await expect(page.getByRole('dialog', { name: 'Kayıt detayı', exact: true })).toBeVisible();
    await ekranDenetle(page); await page.screenshot({ path: info.outputPath(path.split('/')[1] + '-detay.png'), fullPage: false });
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.goto('/edefter/liste');
  await expect(page.getByRole('region', { name: 'e-Defter özeti' }).locator('article')).toHaveCount(4);
  await page.getByRole('combobox', { name: 'Dönem seçimi', exact: true }).selectOption('quarterly');
  await ekranDenetle(page); await page.screenshot({ path: info.outputPath('edefter.png'), fullPage: true });
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
test('8080 ek ekranları ve Görevler Notlar kartları mevcut tasarımını korur', async ({ page }, info) => {
  const errors = hataTopla(page);
  for (const name of ['gorevler', 'notlar']) {
    await page.goto('/' + name);
    await expect(page.locator('.demo-reference')).toHaveCount(0);
    await expect(page.locator('.dr-records')).toHaveCount(0);
    await expect(page.locator('.demo-records > article')).toHaveCount(9);
    await ekranDenetle(page); await page.screenshot({ path: info.outputPath(name + '-korunan.png'), fullPage: true });
  }
  await page.goto('/yonetim/zamanlama'); await expect(page.locator('.demo-reference')).toHaveCount(0);
  await page.goto('/firmalar/devir'); await expect(page.locator('.demo-reference')).toHaveCount(0);
  await page.goto('/kategori/gunluk');
  for (const name of ['Görevler', 'Notlar']) { const card = page.getByRole('link', { name: new RegExp('^' + name) }); await expect(card).toBeVisible(); await expect(card).not.toHaveAttribute('data-reference-card'); }
  expect(errors).toEqual([]);
});
