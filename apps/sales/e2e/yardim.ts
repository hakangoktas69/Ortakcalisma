import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { Redis } from 'ioredis';
import { createPool } from '@eworks/platform';
import { createSalesUser, NodeSalesCrypto, PgSalesUsers, totpCodeAt } from '@eworks/sales';
import { yigin } from '@eworks/testing';

// Satış portalı kabul testi yardımcıları. Her test kendi satış kullanıcısını gerçek use-case'le açar (komutun yaptığı gibi).
// Doğrulayıcı uygulamanın yerine kod, kurulum ekranındaki anahtardan hesaplanır; resimli güvenlik kodunun yanıtı (D41)
// satış uygulamasının Redis'inden okunur (kullanıcı resimden okur; test resmi çözmez).

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

/** Ekrandaki güvenlik kodunun yanıtı: başlangıç çerezindeki kimlikle satış Redis'inden. */
export async function guvenlikKodu(page: Page): Promise<string> {
  const cerez = (await page.context().cookies()).find((c) => c.name.endsWith('ew_satis_baslangic'));
  const url = process.env['TEST_SATIS_REDIS_URL'];
  if (!cerez || !url) throw new Error('başlangıç çerezi ya da TEST_SATIS_REDIS_URL yok');
  const redis = new Redis(url);
  try {
    return (await redis.get(`ew:satis:oturum:${cerez.value}:kod`)) ?? '';
  } finally {
    await redis.quit();
  }
}

/** E-posta adımı. */
export async function epostaGir(page: Page, eposta: string) {
  await page.goto('/giris?yeni=1');
  await page.getByLabel('E-posta').fill(eposta);
  await page.getByRole('button', { name: 'Devam et' }).click();
  await expect(page.getByLabel('Parola')).toBeVisible();
}

/** E-posta + parola (+ ekranda varsa güvenlik kodu, doğru yanıtla) → Giriş yap. */
export async function parolaGir(page: Page, eposta: string, parola: string) {
  await epostaGir(page, eposta);
  await page.getByLabel('Parola').fill(parola);
  if (await page.getByLabel('Güvenlik kodu').isVisible()) await page.getByLabel('Güvenlik kodu').fill(await guvenlikKodu(page));
  await page.getByRole('button', { name: 'Giriş yap' }).click();
}

/** Oturumdaki satışçıya 2FA açar (Parola ve güvenlik → QR/anahtar → parola + kod → kurtarma kodları). */
export async function ikiAdimAc(page: Page, parola: string, denetle = false): Promise<string[]> {
  await page.goto('/sifre');
  await page.getByRole('link', { name: 'İki adımlı doğrulamayı aç' }).click();
  await expect(page.getByRole('img', { name: 'Doğrulayıcı uygulama için QR kod' })).toBeVisible();
  if (denetle) await ekranDenetle(page);
  await page.getByText('QR okutamıyorum: anahtarı elle gir').click();
  const anahtar = (await page.getByLabel('Kurulum anahtarı').textContent())?.trim() ?? '';
  expect(anahtar).toMatch(/^[A-Z2-7]{32}$/);
  await page.locator('#ac-parola').fill(parola);
  await page.getByLabel('Doğrulama kodu').fill(totpCodeAt(anahtar, adim()));
  await page.getByRole('button', { name: 'İki adımlı doğrulamayı aç' }).click();
  const kodlar = page.getByRole('list', { name: 'Kurtarma kodları' }).getByRole('listitem');
  await expect(kodlar).toHaveCount(10);
  const kurtarma = (await kodlar.allTextContents()).map((k) => k.trim());
  if (denetle) await ekranDenetle(page);
  await page.getByRole('link', { name: 'Kodları kaydettim, devam et' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'İki adımlı doğrulama: açık' })).toBeVisible();
  return kurtarma;
}

/** İlk giriş: e-posta → parola + güvenlik kodu → zorunlu parola değişikliği → (istenirse) 2FA açma → ofis listesi. */
export async function satisciHazirla(page: Page, s: { ikiAdim?: boolean; denetle?: boolean } = {}): Promise<Satisci> {
  const { eposta, geciciParola } = await satisciAc();
  await epostaGir(page, eposta);
  // 2FA'sız hesap: güvenlik kodu resmi ve alanı görünür
  await expect(page.getByRole('img', { name: 'Güvenlik kodu resmi' })).toBeVisible();
  if (s.denetle) await ekranDenetle(page);
  await page.getByLabel('Parola').fill(geciciParola);
  await page.getByLabel('Güvenlik kodu').fill(await guvenlikKodu(page));
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  // Geçici parolayla giren önce parolasını değiştirir
  await expect(page).toHaveURL(/\/sifre$/);
  await expect(page.getByText('Geçici parolayla giriş yaptınız.')).toBeVisible();
  if (s.denetle) await ekranDenetle(page);
  const parola = `Satis-${randomUUID().slice(0, 8)}-2026`;
  await page.getByLabel('Mevcut parola').fill(geciciParola);
  await page.getByLabel('Yeni parola', { exact: true }).fill(parola);
  await page.getByLabel('Yeni parola (tekrar)').fill(parola);
  await page.getByRole('button', { name: 'Parolayı değiştir' }).click();
  await expect(page.getByRole('status')).toContainText('Parolanız değişti.');
  const kurtarma = s.ikiAdim ? await ikiAdimAc(page, parola, s.denetle) : [];
  await page.goto('/');
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
