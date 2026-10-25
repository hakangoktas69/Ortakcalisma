import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ofisAc } from './genel-kurulum.ts';
import { girisYap, hataTopla, tasmaYok } from './yardim.ts';

// SGK e-Bildirge: MUHSGK'ların SGK bildirimleri uçtan uca — robot e-Beyanname içinde SGK penceresini açar, SGK tahakkuk ve hizmet
// listesi PDF'lerini indirir, hizmet listesinden çalışan sayısını çıkarır (kişi bilgisi ACL'den çıkmaz). Sahte GİB canlı
// doğrulama sayılmaz (D33): "Toplu güncelle" canlı kayıt girilene dek kırmızı kalır.

const SAHTE_GIB_SIFRE = process.env['SAHTE_GIB_SIFRE'] ?? 'demo-gib-sifre';

test.describe('SGK', () => {
  test.setTimeout(420_000);

  test('@F:sgk.ebildirge.sync @F:sgk.ebildirge.view @F:sgk.ebildirge.download @F:sgk.kontrol.view SGK bildirimleri, çalışan sayısı ve PDF\'ler alınır', async ({ page }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc();
    await girisYap(page, o.yonetici);
    await page.goto('/firmalar/kurum_hesaplari');
    await page.getByLabel('GİB kullanıcı kodu').fill(String(randomInt(10_000_000, 99_999_999)));
    await page.getByLabel('GİB şifresi').fill(SAHTE_GIB_SIFRE);
    await page.getByRole('button', { name: 'GİB hesabını kaydet' }).click();
    await expect(page.getByText('GİB hesabı Vault’a kaydedildi.')).toBeVisible();
    await page.goto('/firmalar/gib_sozlesmeler');
    await page.getByRole('button', { name: 'GİB\'den güncelle' }).click();
    await expect(page.getByRole('status')).toContainText('Tamamlandı', { timeout: 200_000 });

    await page.goto('/sgk/ebildirge');
    await page.getByLabel('Gönderim ayı (başlangıç)').fill('2026-08');
    await page.getByLabel('Gönderim ayı (bitiş)').fill('2026-08');
    const secim = page.getByLabel('Mükellef');
    await secim.selectOption((await secim.locator('option').nth(1).getAttribute('value'))!);
    await page.getByRole('button', { name: 'SGK bildirimlerini güncelle' }).click();
    const durum = page.getByRole('status');
    await expect(durum).toContainText('Tamamlandı', { timeout: 300_000 });
    await expect(durum).toContainText('SGK bildirimi');
    await page.reload();
    const tablo = page.getByRole('table', { name: 'SGK bildirimleri' });
    await expect(tablo.locator('tbody tr').first()).toBeVisible();
    await expect(tablo.locator('tbody tr').first().locator('td').nth(4)).toHaveText(/^\d+$/);
    await tasmaYok(page);
    const [pdf] = await Promise.all([page.waitForEvent('download'), tablo.getByRole('link', { name: 'SGK hizmet listesi' }).first().click()]);
    expect(pdf.suggestedFilename()).toMatch(/^MUHSGK-2026-0\d-hizmet-listesi\.pdf$/);
    expect(readFileSync((await pdf.path())!).subarray(0, 5).toString()).toBe('%PDF-');

    await page.goto('/sgk/kontrol');
    await expect(page.locator('td[data-donem] .etiket', { hasText: 'çalışan' }).first()).toBeVisible();
    await tasmaYok(page);
    expect(hatalar).toEqual([]);
  });

  test('personel SGK toplu güncelleme başlatamaz (uç 403), bildirimleri görüntüleyebilir', async ({ page }) => {
    const o = await ofisAc(true);
    await girisYap(page, o.personel);
    await page.goto('/sgk/ebildirge');
    await expect(page.getByRole('button', { name: 'SGK bildirimlerini güncelle' })).toHaveCount(0);
    await expect(page.getByText('Kayıt bulunamadı.')).toBeVisible();
    const csrf = await page.locator('input[name="csrf"]').first().inputValue();
    const durum = await page.evaluate(
      async (c) => (await fetch('/api/sync/muhsgk', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': c }, body: '{"bas":"2026-08","bit":"2026-08"}' })).status,
      csrf,
    );
    expect(durum).toBe(403);
  });
});
