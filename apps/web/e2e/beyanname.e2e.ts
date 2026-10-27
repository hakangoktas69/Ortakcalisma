import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ofisAc } from './genel-kurulum.ts';
import { ekranDenetle, gibBilgileriniAc, girisYap, hataTopla } from './yardim.ts';

// e-Beyanname: uçtan uca gerçek akış — web → kuyruk → Python robotu (aynı oturumda sözleşme listesi + e-Beyanname, PDF'ler)
// → sahte GİB → S3 → işçi (tax-filing + documents). Sahte GİB canlı doğrulama sayılmaz (D33): "Senkron başlat" canlı kayıt
// girilene dek kırmızı kalır. Her test kendi ofisini açar.

const SAHTE_GIB_SIFRE = process.env['SAHTE_GIB_SIFRE'] ?? 'demo-gib-sifre';

async function gibHesabiVeSozlesmeler(page: Page) {
  await page.goto('/firmalar/kurum_hesaplari');
  await gibBilgileriniAc(page);
  await page.getByLabel('GİB kullanıcı kodu').fill(String(randomInt(10_000_000, 99_999_999)));
  await page.getByLabel('GİB şifresi').fill(SAHTE_GIB_SIFRE);
  await page.getByRole('button', { name: 'GİB hesabını kaydet' }).click();
  await expect(page.getByText('GİB hesabı Vault’a kaydedildi.')).toBeVisible();
  await page.goto('/firmalar/gib_sozlesmeler');
  await page.getByRole('button', { name: 'GİB\'den güncelle' }).click();
  await expect(page.getByRole('status')).toContainText('Tamamlandı', { timeout: 200_000 });
}

test.describe('e-Beyanname', () => {
  test.setTimeout(420_000);

  test('@F:beyanname.senkron.start @F:beyanname.liste.view @F:beyanname.liste.export @F:beyanname.kontrol.view @F:beyanname.belge.view @F:beyanname.belge.download @F:firmalar.gib_sozlesmeler.review beyannameler ve PDF\'ler alınır, listelenir, indirilir', async ({ page }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc();
    await girisYap(page, o.yonetici);
    await gibHesabiVeSozlesmeler(page);
    // Kurum incelemesi: hangi mükellefin beyannamesi sorgulanabilir
    await page.reload();
    await expect(page.getByRole('heading', { name: /Kurum incelemesi/ })).toBeVisible();
    await expect(page.getByText('Beyanname sorgulanabilir').first()).toBeVisible();
    await ekranDenetle(page);

    await page.goto('/beyanname/senkron');
    await page.getByLabel('Gönderim ayı (başlangıç)').fill('2026-08');
    await page.getByLabel('Gönderim ayı (bitiş)').fill('2026-08');
    const secim = page.getByLabel('Mükellef');
    const ilkFirma = await secim.locator('option').nth(1).getAttribute('value');
    await secim.selectOption(ilkFirma!);
    await ekranDenetle(page);
    await page.getByRole('button', { name: 'Senkronu başlat' }).click();
    const durum = page.getByRole('status');
    await expect(durum).toContainText('Tamamlandı', { timeout: 300_000 });
    await expect(durum).toContainText('1 sorgu');
    await expect(durum).toContainText('sahte GİB');

    await page.goto('/beyanname/liste');
    const satirlar = page.locator('tbody tr');
    await expect(satirlar.first()).toBeVisible();
    expect(await satirlar.count()).toBeGreaterThan(0);
    await expect(page.getByText('Kayıt bulunamadı.')).toHaveCount(0);
    await ekranDenetle(page);
    const [pdf] = await Promise.all([page.waitForEvent('download'), satirlar.first().getByRole('link', { name: 'Beyanname', exact: true }).click()]);
    expect(pdf.suggestedFilename()).toMatch(/^[A-Z0-9_-]+-2026-0\d-beyanname\.pdf$/);
    expect(readFileSync((await pdf.path())!).subarray(0, 5).toString()).toBe('%PDF-');
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'CSV indir' }).click()]);
    expect(readFileSync((await csv.path())!, 'utf8').startsWith('﻿"Mükellef";"VKN/TCKN";"Beyanname türü"')).toBe(true);

    await page.goto('/beyanname/kontrol');
    await expect(page.locator('td[data-donem] .etiket.iyi').first()).toBeVisible();
    await ekranDenetle(page);

    await page.goto('/beyanname/belge');
    await expect(page.getByRole('link', { name: 'PDF indir' }).first()).toBeVisible();
    await expect(page.getByText('Vergi tahakkuku').first()).toBeVisible();
    await ekranDenetle(page);
    expect(hatalar).toEqual([]);
  });

  test('personel beyanname senkronu başlatamaz (uç 403); başka ofisin belgesi 404', async ({ page }) => {
    const o = await ofisAc(true);
    await girisYap(page, o.personel);
    await page.goto('/beyanname/senkron');
    await expect(page.getByRole('heading', { name: 'Yetkiniz yok' })).toBeVisible();
    const csrf = await page.locator('input[name="csrf"]').first().inputValue();
    const durum = await page.evaluate(
      async (c) => (await fetch('/api/sync/beyannameler', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': c }, body: '{"bas":"2026-08","bit":"2026-08"}' })).status,
      csrf,
    );
    expect(durum).toBe(403);
    await page.goto('/beyanname/liste');
    await expect(page.getByText('Kayıt bulunamadı.')).toBeVisible();
    const baska = await ofisAc();
    await page.context().clearCookies();
    await girisYap(page, baska.yonetici);
    expect((await page.request.get('/api/belgeler/00000000-0000-4000-8000-000000000000')).status()).toBe(404);
  });
});
