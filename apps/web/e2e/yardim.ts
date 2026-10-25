import { readFileSync } from 'node:fs';
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
export async function tasmaYok(page: Page) {
  const tasma = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(tasma, 'sayfa yatay taşıyor').toBeLessThanOrEqual(1);
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

/** Dar ekranda menü düğmeyle açılır; geniş ekranda zaten açıktır. */
export async function menuyuAc(page: Page) {
  const dugme = page.locator('.menu-dugme');
  if (await dugme.isVisible()) await dugme.click();
  await expect(page.locator('nav.menu')).toBeVisible();
}
