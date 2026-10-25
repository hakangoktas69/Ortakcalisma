import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { ofisAc } from './genel-kurulum.ts';
import { ekranDenetle, girisYap, hataTopla } from './yardim.ts';

// GİB e-Beyanname sözleşmeleri: uçtan uca gerçek akış — web → outbox → RabbitMQ → Python robot (başsız tarayıcı, otomatik
// güvenlik kodu) → sahte GİB → S3 → işçi → tax-filing + portfolio. Sahte GİB canlı doğrulama sayılmaz (D33): bu testler
// geçse de "GİB'den güncelle" canlı kayıt girilene dek kırmızı kalır.
// Her test kendi ofisini açar: hesap durumu (hatalı şifre) ve VKN tekilliği testler arasında paylaşılmasın.

const SAHTE_GIB_SIFRE = process.env['SAHTE_GIB_SIFRE'] ?? 'demo-gib-sifre';
const kullaniciKodu = () => String(randomInt(10_000_000, 99_999_999));

async function musavirHesabiKaydet(page: Page, kod: string, sifre: string) {
  await page.goto('/firmalar/kurum_hesaplari');
  await page.getByLabel('GİB kullanıcı kodu').fill(kod);
  await page.getByLabel('GİB şifresi').fill(sifre);
  await page.getByRole('button', { name: 'GİB hesabını kaydet' }).click();
  await expect(page.getByText('GİB hesabı Vault’a kaydedildi.')).toBeVisible();
}

test.describe('GİB sözleşmeleri', () => {
  test.setTimeout(240_000);

  test('@F:firmalar.gib_sozlesmeler.sync @F:firmalar.gib_sozlesmeler.view sözleşme listesi robotla okunur, mükellefler firma olarak açılır', async ({ page }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc();
    await girisYap(page, o.yonetici);
    await musavirHesabiKaydet(page, kullaniciKodu(), SAHTE_GIB_SIFRE);
    await page.goto('/firmalar/gib_sozlesmeler');
    await expect(page.getByText('Henüz sözleşme yok.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'GİB\'den güncelle' }).click();
    const durum = page.getByRole('status');
    await expect(durum).toContainText('Tamamlandı', { timeout: 200_000 });
    await expect(durum).toContainText('45 sözleşme');
    await expect(durum).toContainText('sahte GİB');
    await expect(page.getByText('Bu ortamdaki liste sahte GİB sunucusundan (demo) okundu')).toBeVisible();
    await expect(page.getByRole('table', { name: 'GİB e-Beyanname sözleşmeleri' }).locator('tbody tr')).toHaveCount(45);
    await ekranDenetle(page);
    // Yeni mükellefler firma listesinde; ikinci senkron yeni firma açmaz, mevcutlarla eşleşir
    await page.goto('/firmalar/liste');
    const firmaSayisi = await page.locator('tbody tr').count();
    expect(firmaSayisi).toBeGreaterThan(0);
    await page.goto('/firmalar/gib_sozlesmeler');
    await page.getByRole('button', { name: 'GİB\'den güncelle' }).click();
    await expect(durum).toContainText('0 yeni', { timeout: 200_000 });
    await page.goto('/firmalar/liste');
    await expect(page.locator('tbody tr')).toHaveCount(firmaSayisi);
    expect(hatalar).toEqual([]);
  });

  test('@F:firmalar.gib_sozlesmeler.sync hatalı GİB şifresi tanınır, hesap durdurulur ve kullanıcıya söylenir', async ({ page }) => {
    const o = await ofisAc();
    await girisYap(page, o.yonetici);
    await musavirHesabiKaydet(page, kullaniciKodu(), 'yanlis-sifre');
    await page.goto('/firmalar/gib_sozlesmeler');
    await page.getByRole('button', { name: 'GİB\'den güncelle' }).click();
    await expect(page.getByRole('status')).toContainText('Kurum şifresi hatalı', { timeout: 200_000 });
    await page.reload();
    await expect(page.getByText('Şifre hatalı — yeniden girin')).toBeVisible();
    // Hatalı şifreli hesapla yeni iş açılmaz (GİB hesabı kilitlenmesin)
    await page.getByRole('button', { name: 'GİB\'den güncelle' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Kayıtlı GİB şifresi hatalı' })).toBeVisible();
  });

  test('personel GİB senkronunu başlatamaz (uç 403)', async ({ page }) => {
    const o = await ofisAc(true);
    await girisYap(page, o.personel);
    const csrf = await page.locator('input[name="csrf"]').first().inputValue();
    const durum = await page.evaluate(async (c) => (await fetch('/api/sync/gib-sozlesmeler', { method: 'POST', headers: { 'x-csrf-token': c } })).status, csrf);
    expect(durum).toBe(403);
  });
});
