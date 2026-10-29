import { test, expect } from '@playwright/test';
import { girisYap, ekranDenetle, hataTopla } from '../e2e/yardim.ts';

test.beforeEach(async ({ page }) => {
  const parola = process.env['DEMO_SIFRE']; if (!parola) throw new Error('Demo şifresi gerekli');
  await girisYap(page, { eposta: 'demo@eworks.test', parola }); await page.goto('/beyanname/liste');
});

test('beyanname zaman kartları yıl, ay, son yedi gün ve bağımsız dönem aralığını uygular', async ({ page }, info) => {
  const errors = hataTopla(page); const writes: string[] = []; page.on('request', r => { if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(r.url()); });
  const dates = page.getByRole('region', { name: 'e-Beyanname tarih seçimi' });
  await expect(dates.getByRole('heading', { name: 'Yükleme Zamanı Seçimi' })).toBeVisible();
  await dates.getByRole('combobox', { name: 'Beyanname yılı' }).selectOption('2024');
  await dates.getByRole('button', { name: 'Şubat 2024', exact: true }).click();
  await expect(dates.getByLabel('Yükleme Başlangıç Tarihi')).toHaveValue('2024-02-01');
  await expect(dates.getByLabel('Yükleme Bitiş Tarihi')).toHaveValue('2024-02-29');
  await dates.getByRole('button', { name: 'Son 7 Gün', exact: true }).click();
  await expect(dates.getByLabel('Yükleme Başlangıç Tarihi')).toHaveValue('2026-10-23');
  await expect(dates.getByLabel('Yükleme Bitiş Tarihi')).toHaveValue('2026-10-29');
  await expect(dates.getByRole('button', { name: 'Kasım 2026', exact: true })).toBeDisabled();
  await dates.getByRole('tab', { name: 'Dönem Aralığı', exact: true }).click();
  await dates.getByRole('button', { name: 'Eylül 2026', exact: true }).click();
  await dates.getByRole('button', { name: 'Temmuz 2026', exact: true }).click();
  for (const month of ['Temmuz', 'Ağustos', 'Eylül']) await expect(dates.getByRole('button', { name: `${month} 2026`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dates.getByLabel('Yükleme Başlangıç Tarihi')).toHaveValue('2026-10-23');
  await ekranDenetle(page); await dates.screenshot({ path: info.outputPath('beyanname-zaman-filtreleri.png') });
  await dates.getByRole('button', { name: 'Güncel e-Beyannameleri Çek', exact: true }).click();
  const transfer = page.getByRole('region', { name: 'Beyanname aktarım ve arşiv' });
  await expect(transfer).toContainText('Planlanan: 3');
  await expect(dates).toContainText('Dönem: 2026-07 – 2026-09');
  await dates.getByRole('button', { name: 'Eksik belgeleri tamamla', exact: true }).click();
  await transfer.getByRole('combobox', { name: 'Belge arşivi dönemi' }).selectOption('2026-08');
  await expect(transfer.locator('.demo-document')).toHaveCount(2);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});

test('beyanname seçimini temizleme, hatalı aralık ve klavyeyle zaman türü değiştirme', async ({ page }) => {
  const dates = page.getByRole('region', { name: 'e-Beyanname tarih seçimi' });
  await dates.getByRole('button', { name: 'Seçimi Temizle', exact: true }).click();
  await expect(dates.getByLabel('Yükleme Başlangıç Tarihi')).toHaveValue('');
  await dates.getByRole('button', { name: 'Güncel e-Beyannameleri Çek', exact: true }).click();
  await expect(dates.getByRole('alert')).toContainText('Geçerli ve sıralı yükleme tarihleri');
  await dates.getByRole('button', { name: 'Son 7 Gün', exact: true }).click();
  await dates.getByRole('tab', { name: 'Dönem Aralığı', exact: true }).click();
  await dates.getByRole('button', { name: 'Güncel e-Beyannameleri Çek', exact: true }).click();
  await expect(dates.getByRole('alert')).toContainText('İlk ve son ayı seçerek');
  await dates.getByRole('tab', { name: 'Dönem Aralığı', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(dates.getByRole('tab', { name: 'Yükleme Zamanı', exact: true })).toBeFocused();
  await expect(dates.getByRole('tab', { name: 'Yükleme Zamanı', exact: true })).toHaveAttribute('aria-selected', 'true');
  await dates.getByLabel('Yükleme Başlangıç Tarihi').fill('2026-10-29');
  await dates.getByLabel('Yükleme Bitiş Tarihi').fill('2026-10-01');
  await dates.getByRole('button', { name: 'Güncel e-Beyannameleri Çek', exact: true }).click();
  await expect(dates.getByRole('alert')).toContainText('Geçerli ve sıralı yükleme tarihleri');
  await ekranDenetle(page);
});
