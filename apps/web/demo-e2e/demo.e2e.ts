import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { isAllowed, ROLE_TEMPLATES } from '@eworks/identity-access';
import { demoCatalog } from '../src/shared/demo/catalog.ts';
import { ekranDenetle, girisYap, hataTopla } from '../e2e/yardim.ts';

test.beforeEach(async ({ page }) => {
  const parola = process.env['DEMO_SIFRE'];
  if (!parola) throw new Error('DEMO_SIFRE gerekli; parola test çıktısına yazılmaz.');
  await girisYap(page, { eposta: process.env['DEMO_EPOSTA'] ?? 'demo@eworks.test', parola });
});

test('ana sayfa kategori kartlarını gösterir; alt sayfadan dönüş ve logo aynı ana sayfaya götürür', async ({ page }, info) => {
  const errors = hataTopla(page);
  await page.goto('/');
  const categories = page.getByRole('navigation', { name: 'Ana sayfa kategorileri' });
  await expect(categories.getByRole('link')).toHaveCount(4);
  await expect(page.getByRole('link', { name: '← Ana sayfa', exact: true })).toHaveCount(0);
  await categories.getByRole('link', { name: /Günlük Yönetim/ }).click();
  await expect(page).toHaveURL(/\/kategori\/gunluk$/);
  await expect(page.getByRole('navigation', { name: 'Bölüm sayfaları' }).getByRole('link', { name: /^Firmalarım/ })).toBeVisible();
  await ekranDenetle(page);
  await page.screenshot({ path: info.outputPath('moduller.png'), fullPage: true });
  await page.getByRole('link', { name: /^e-Defter/ }).click();
  await expect(page.locator('[data-demo-page]')).toHaveAttribute('data-demo-page', 'edefter.liste');
  await page.getByRole('link', { name: '← Ana sayfa', exact: true }).click();
  await expect(categories).toBeVisible();
  await page.goto('/sgk/ebildirge');
  await page.getByRole('link', { name: 'Eworks ana sayfa', exact: true }).click();
  await expect(categories).toBeVisible();
  await expect(page.getByRole('link', { name: '← Ana sayfa', exact: true })).toHaveCount(0);
  await expect(page.locator('.kart-simge')).toHaveCount(4);
  await ekranDenetle(page);
  await page.screenshot({ path: info.outputPath('anasayfa.png'), fullPage: true });
  await page.goto('/beyanname/liste');
  const tabs = page.getByRole('navigation', { name: 'Bölüm sayfaları' });
  await tabs.getByRole('link', { name: 'e-Beyanname kontrol', exact: true }).click();
  await expect(page.locator('[data-demo-page]')).toHaveAttribute('data-demo-page', 'beyanname.kontrol');
  await expect(tabs.getByRole('link', { name: 'e-Beyanname kontrol', exact: true })).toHaveAttribute('aria-current', 'page');
  await ekranDenetle(page);
  await page.screenshot({ path: info.outputPath('sekmeler.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('tüm demo içerik sayfaları örnek verilerle açılır, taşma ve ciddi erişilebilirlik hatası yoktur', async ({ page }) => {
  const errors = hataTopla(page);
  for (const p of demoCatalog(key => isAllowed(ROLE_TEMPLATES.ofis_admin, key))) {
    await page.goto(p.path);
    await expect(page.locator('[data-demo-page]')).toHaveAttribute('data-demo-page', p.key);
    await expect(page.getByRole('heading', { level: 1, name: p.key === 'genel_bakis.panel' ? 'İşlerinizi tek merkezden yönetin' : p.key === 'genel_bakis.takvim' ? 'Mali Müşavir Takvimi' : p.key === 'firmalar.liste' ? 'Firmalarım' : p.title, exact: true })).toBeVisible();
    await expect(page.getByText('DEMO · Tamamen kurgusal veriler', { exact: true })).toBeVisible();
    await expect(page.getByText(/yakında kullanıma açılacak/)).toHaveCount(0);
    await ekranDenetle(page);
  }
  await page.goto('/yonetim/hiz_politikasi');
  await expect(page.getByRole('heading', { name: 'Sayfa kullanılamıyor' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('arama, boş durum, filtre temizleme, detay ve örnek PDF çalışır; tebligat belgesi açılmaz', async ({ page }) => {
  const errors = hataTopla(page);
  await page.goto('/sgk/ebildirge');
  await page.getByRole('textbox', { name: 'Firma veya açıklama ara' }).fill('BULUNMAYAN');
  await expect(page.getByRole('heading', { name: 'Kayıt bulunamadı' })).toBeVisible();
  await page.getByRole('button', { name: 'Filtreleri temizle' }).click();
  await page.getByRole('combobox', { name: 'Dönem', exact: true }).selectOption('2026-08');
  await expect(page.locator('.demo-record')).toHaveCount(3);
  await page.getByRole('button', { name: /detay$/i }).first().click();
  await expect(page.getByRole('region', { name: 'Kayıt detayı' })).toContainText('2026-08');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Örnek PDF indir', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('demo-sgk-2026-08.pdf');
  const path = await download.path();
  if (!path) throw new Error('PDF indirilmedi');
  expect(await readFile(path, 'utf8')).toContain('DEMO - ORNEK BELGE');
  await page.goto('/tebligat/liste');
  await page.getByRole('button', { name: /detay$/i }).first().click();
  await expect(page.getByText(/Tebligat belgesi açılmaz/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Örnek PDF indir', exact: true })).toHaveCount(0);
  await ekranDenetle(page);
  expect(errors).toEqual([]);
});

test('yerel ekleme ve düzenleme yenilemede korunur; gerçek API ve kurum çağrısı yapılmaz', async ({ page }) => {
  const errors = hataTopla(page);
  const writes: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/')) writes.push(r.url()); });
  await page.goto('/notlar');
  await page.getByRole('button', { name: 'Oluştur', exact: true }).click();
  await page.getByRole('textbox', { name: 'Açıklama', exact: true }).fill('Demo test notu');
  await page.getByRole('button', { name: 'Demo kaydını kaydet' }).click();
  await expect(page.getByRole('heading', { name: 'Demo test notu', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Demo test notu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /detay$/i }).first().click();
  await page.getByRole('button', { name: 'Kaydı düzenle' }).click();
  await page.getByRole('textbox', { name: 'Açıklama', exact: true }).fill('Düzenlenen demo notu');
  await page.getByRole('button', { name: 'Demo kaydını kaydet' }).click();
  await expect(page.getByRole('heading', { name: 'Düzenlenen demo notu', exact: true })).toBeVisible();
  await page.goto('/beyanname/senkron');
  await page.getByRole('button', { name: 'Senkron başlat', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Demo aktarımı tamamlandı' })).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  await ekranDenetle(page);
});

test('e-Defter ve ödeme ekranlarında demo ayrımı görünür, ekran görüntüleri alınır', async ({ page }, info) => {
  await page.goto('/edefter/liste');
  await expect(page.getByRole('table')).toContainText('YB / KB');
  await ekranDenetle(page);
  await page.screenshot({ path: info.outputPath('edefter.png'), fullPage: true });
  await page.goto('/odeme/online');
  await expect(page.getByText(/ödeme ve ileti gönderimi yapılmaz/)).toBeVisible();
  await ekranDenetle(page);
  await page.screenshot({ path: info.outputPath('odeme.png'), fullPage: true });
});
