import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { createPool } from '@eworks/platform';
import { createSalesUser, NodeSalesCrypto, PgSalesUsers, totpCodeAt } from '@eworks/sales';
import { yigin } from '@eworks/testing';

// Satış portalı kabul testi yardımcıları. Her test kendi satış kullanıcısını gerçek use-case'le açar (komutun yaptığı gibi);
// doğrulayıcı uygulamanın yerine kod, kurulum ekranındaki anahtardan hesaplanır.

export type Satisci = { eposta: string; parola: string; kurtarma: string[] };

/** Komutun yaptığını yapar: satış kullanıcısı + geçici parola. Mühür anahtarı burada kullanılmaz (yalnız kurulumda, sunucuda). */
export async function satisciAc(): Promise<{ eposta: string; geciciParola: string }> {
  const db = createPool(yigin.controlUrl('eworks_sales'), 1);
  try {
    const eposta = `satis-${randomUUID().slice(0, 8)}@eworks.test`;
    const r = await createSalesUser(
      { email: eposta, fullName: 'Selin Satış' },
      { users: new PgSalesUsers(db), crypto: new NodeSalesCrypto('kabul-testi-yalniz-ozet-icin-kullanilir'), newId: randomUUID },
    );
    if (!r.ok) throw new Error(r.error);
    return { eposta, geciciParola: r.value.tempPassword };
  } finally {
    await db.end();
  }
}

export const adim = () => Math.floor(Date.now() / 30_000);

export async function parolaGir(page: Page, eposta: string, parola: string) {
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill(eposta);
  await page.getByLabel('Parola').fill(parola);
  await page.getByRole('button', { name: 'Devam et' }).click();
}

/** İlk giriş: parola → 2FA kurulumu (anahtar ekrandan) → kurtarma kodları → zorunlu parola değişikliği → ofis listesi. */
export async function satisciHazirla(page: Page, denetle = false): Promise<Satisci> {
  const { eposta, geciciParola } = await satisciAc();
  await parolaGir(page, eposta, geciciParola);
  await expect(page).toHaveURL(/\/giris\/kurulum$/);
  await expect(page.getByRole('img', { name: 'Doğrulayıcı uygulama için QR kod' })).toBeVisible();
  if (denetle) await ekranDenetle(page);
  await page.getByText('QR okutamıyorum: anahtarı elle gir').click();
  const anahtar = (await page.getByLabel('Kurulum anahtarı').textContent())?.trim() ?? '';
  expect(anahtar).toMatch(/^[A-Z2-7]{32}$/);
  await page.getByLabel('Doğrulama kodu').fill(totpCodeAt(anahtar, adim()));
  await page.getByRole('button', { name: 'Kurulumu tamamla' }).click();
  const kodlar = page.getByRole('list', { name: 'Kurtarma kodları' }).getByRole('listitem');
  await expect(kodlar).toHaveCount(10);
  const kurtarma = (await kodlar.allTextContents()).map((k) => k.trim());
  if (denetle) await ekranDenetle(page);
  await page.getByRole('link', { name: 'Kodları kaydettim, devam et' }).click();
  // Geçici parolayla giren önce parolasını değiştirir
  await expect(page).toHaveURL(/\/sifre$/);
  await expect(page.getByText('Geçici parolayla giriş yaptınız.')).toBeVisible();
  if (denetle) await ekranDenetle(page);
  const parola = `Satis-${randomUUID().slice(0, 8)}-2026`;
  await page.getByLabel('Mevcut parola').fill(geciciParola);
  await page.getByLabel('Yeni parola', { exact: true }).fill(parola);
  await page.getByLabel('Yeni parola (tekrar)').fill(parola);
  await page.getByRole('button', { name: 'Parolayı değiştir' }).click();
  await expect(page.getByRole('status')).toContainText('Parolanız değişti.');
  await page.getByRole('link', { name: 'Ofis listesine git' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ofisler' })).toBeVisible();
  return { eposta, parola, kurtarma };
}

/** Duyarlı arayüz: sayfa yatay taşmamalı (dört ekran sınıfı). Tablo kendi kabında kayar. */
async function tasmaYok(page: Page) {
  const tasma = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(tasma, 'sayfa yatay taşıyor').toBeLessThanOrEqual(1);
}

/** Erişilebilirlik (D37): axe-core WCAG 2.1 A/AA'da ciddi ya da kritik ihlal yok. */
async function erisilebilirlik(page: Page) {
  const sonuc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const ihlaller = sonuc.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.nodes.length} öğe): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(ihlaller, 'erişilebilirlik ihlali').toEqual([]);
}

/** Her ekran denetimi (D37): başlık var, sayfa taşmıyor, erişilebilirlik ihlali yok. */
export async function ekranDenetle(page: Page) {
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

/** Sayfanın uyarısı (Next.js'in boş rota duyurucusu `__next-route-announcer__` da role=alert taşır; o hariç). */
export const uyari = (page: Page) => page.getByRole('alert').and(page.locator(':not(#__next-route-announcer__)'));
