import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { KULLANICILAR, type E2eKullanicilar } from './genel-kurulum.ts';

export const kullanicilar = (): E2eKullanicilar => JSON.parse(readFileSync(KULLANICILAR, 'utf8')) as E2eKullanicilar;

export async function girisYap(page: Page, k: { eposta: string; parola: string }) {
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill(k.eposta);
  await page.getByLabel('Parola').fill(k.parola);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('button', { name: 'Çıkış' })).toBeVisible();
}

/** Duyarlı arayüz: sayfa yatay taşmamalı (dört ekran sınıfı). Tablolar kendi kabında kayar. */
async function tasmaYok(page: Page) {
  const tasma = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(tasma, 'sayfa yatay taşıyor').toBeLessThanOrEqual(1);
}

/**
 * Erişilebilirlik (D37): axe-core'un WCAG 2.1 A/AA kurallarında ciddi ya da kritik ihlal yok. Ekran okuyucu, klavye ve
 * renk karşıtlığı sorunlarını yakalar; orta/küçük etkili ihlaller ve otomatik denetlenemeyen ölçütler kapsam dışıdır
 * (UX kontrol listesi, gelistir C3). İhlal kimliği ve etkilenen öğeler hata mesajında görünür.
 */
async function erisilebilirlik(page: Page) {
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const ihlaller = sonuc.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.nodes.length} öğe): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(ihlaller, 'erişilebilirlik ihlali').toEqual([]);
}

/** Her ekran denetimi (D37): sayfa taşmıyor ve erişilebilirlik ihlali yok. Ekran boyutuna göre sonuç değişir (dar ekranda kayan tablo), dört sınıfta da koşar. */
export async function ekranDenetle(page: Page) {
  // Sunucudan yenileme (router.refresh) sırasında <title> kısa süre kalkabiliyordu; tarama ona denk gelirse document-title ihlali
  // veriyordu (kararsız test). Başlık yerleşene kadar beklenir; her sayfada başlık olduğu da böylece doğrulanır.
  await expect(page).toHaveTitle(/\S/);
  await tasmaYok(page);
  await erisilebilirlik(page);
}

/** Konsol hatası ve 5xx yanıtları toplar; test sonunda boş olmalı. */
export function hataTopla(page: Page) {
  const hatalar: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`konsol: ${m.text()}`);
  });
  page.on('pageerror', (e) => hatalar.push(`sayfa: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 500) hatalar.push(`${r.status()} ${r.url()}`);
  });
  return hatalar;
}
