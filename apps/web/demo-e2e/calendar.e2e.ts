import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { girisYap, ekranDenetle, hataTopla } from '../e2e/yardim.ts';

test.beforeEach(async ({ page }) => {
  const parola = process.env['DEMO_SIFRE']; if (!parola) throw new Error('Demo şifresi gerekli');
  await girisYap(page, { eposta: 'demo@eworks.test', parola }); await page.goto('/genel_bakis/takvim');
});

test('8765 benzeri takvimde mini ay, yıl, kaynak ve arama filtreleri çalışır', async ({ page }, info) => {
  const errors = hataTopla(page); const calendar = page.getByRole('region', { name: 'Mali müşavir demo takvimi' });
  await expect(calendar.getByRole('region', { name: 'Mini takvim Ekim 2026', exact: true }).getByRole('button')).toHaveCount(44);
  await calendar.getByRole('button', { name: 'Mini takvim sonraki ay' }).click();
  await expect(calendar.getByRole('region', { name: 'Mini takvim Kasım 2026', exact: true })).toBeVisible();
  await calendar.getByRole('button', { name: 'Mini takvim önceki ay' }).click();
  await calendar.getByRole('button', { name: 'Yıllık', exact: true }).click();
  await expect(calendar.locator('.dc-year .dc-mini')).toHaveCount(12);
  await calendar.getByRole('button', { name: 'Mart 2026 ayını aç', exact: true }).click();
  await expect(calendar.getByRole('button', { name: 'Aylık', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await calendar.getByRole('button', { name: 'Bugün', exact: true }).click();
  await calendar.getByRole('button', { name: 'Temizle', exact: true }).click();
  await expect(calendar.locator('.dc-event')).toHaveCount(0);
  await calendar.getByRole('button', { name: 'Tümünü Seç', exact: true }).click();
  await expect(calendar.locator('.dc-event').first()).toBeVisible();
  await calendar.getByRole('searchbox', { name: 'Takvimde ara' }).fill('OLMAYAN ÖRNEK');
  await expect(calendar.locator('.dc-event')).toHaveCount(0);
  await calendar.getByRole('searchbox', { name: 'Takvimde ara' }).fill('');
  await ekranDenetle(page); await page.screenshot({ path: info.outputPath('takvim-8765-duzeni.png'), fullPage: true }); expect(errors).toEqual([]);
});

test('takvim gün çekmecesi, mükellefli ayrıntılı hatırlatma, düzenleme, durum ve CSV', async ({ page }, info) => {
  const errors = hataTopla(page); const writes: string[] = []; page.on('request', r => { if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(r.url()); });
  const calendar = page.getByRole('region', { name: 'Mali müşavir demo takvimi' });
  await calendar.getByRole('button', { name: '+2 daha', exact: true }).click();
  let dialog = page.getByRole('dialog'); await expect(dialog).toContainText('Günün etkinlikleri');
  await dialog.getByRole('button', { name: 'Örnek dönem beyanname kontrolü', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kişisel hatırlatma ekle', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'İlgili mükellef' }).selectOption('mavi');
  await dialog.getByLabel('Saat (isteğe bağlı)').fill('10:30');
  await dialog.getByRole('combobox', { name: 'Hatırlatma süresi' }).selectOption('7');
  await dialog.getByRole('textbox', { name: 'Sorumlu', exact: true }).fill('Demo Ece');
  await dialog.getByRole('textbox', { name: 'Not', exact: true }).fill('Kaynak notu');
  await expect(dialog).toHaveCSS('position', 'fixed');
  expect((await dialog.boundingBox())?.y).toBe(0);
  await ekranDenetle(page); await page.screenshot({ path: info.outputPath('hatirlatma-detay-form.png'), fullPage: false });
  await dialog.getByRole('button', { name: 'Örnek hatırlatmayı ekle' }).click();
  await calendar.getByRole('searchbox', { name: 'Takvimde ara' }).fill('Kaynak notu');
  await calendar.getByRole('region', { name: 'Seçilen gün' }).getByRole('button', { name: /Demo · Örnek dönem beyanname kontrolü/ }).click();
  dialog = page.getByRole('dialog'); await expect(dialog).toContainText('Demo Mavi İnşaat A.Ş.'); await expect(dialog).toContainText('7 gün önce'); await expect(dialog).toContainText('Demo Ece');
  await dialog.getByRole('button', { name: 'Düzenle', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Hatırlatma başlığı' }).fill('Düzenlenen firma hatırlatması');
  await dialog.getByRole('button', { name: 'Örnek hatırlatmayı ekle' }).click();
  await calendar.getByRole('region', { name: 'Seçilen gün' }).getByRole('button', { name: /Düzenlenen firma hatırlatması/ }).click();
  await dialog.getByRole('button', { name: 'Tamamlandı', exact: true }).click(); await expect(dialog.getByText('Tamamlandı', { exact: true })).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Takvim detayını kapat' }).click();
  await calendar.getByRole('combobox', { name: 'Takvim mükellef filtresi' }).selectOption('mavi');
  const downloadEvent = page.waitForEvent('download'); await calendar.getByRole('button', { name: 'Excel / CSV', exact: true }).click(); const download = await downloadEvent;
  const path = await download.path(); if (!path) throw new Error('CSV yok'); const csv = await readFile(path, 'utf8'); expect(csv).toContain('DEMO'); expect(csv).toContain('Düzenlenen firma hatırlatması'); expect(csv).toContain('Demo Mavi');
  await calendar.getByRole('combobox', { name: 'Takvim mükellef filtresi' }).selectOption('atlas');
  await expect(calendar.getByRole('region', { name: 'Seçilen gün' }).getByRole('button', { name: /Düzenlenen firma hatırlatması/ })).toHaveCount(0);
  await ekranDenetle(page); expect(writes).toEqual([]); expect(errors).toEqual([]);
});
