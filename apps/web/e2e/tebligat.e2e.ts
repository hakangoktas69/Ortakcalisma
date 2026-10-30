import { expect, test, type Page } from '@playwright/test';
import { fakeVkn } from '@eworks/testing';
import { ofisAc } from './genel-kurulum.ts';
import { ekranDenetle, gibBilgileriniAc, girisYap, hataTopla } from './yardim.ts';

// e-Tebligat (notices, D45) ve mükellef onayı (credentials, D46): firmanın kendi GİB hesabıyla, onay varken liste okunur; belge
// açılmaz. Sahte GİB (canlı GİB değildir, D33): görünen hesap kimliği kullanıcı kodudur, liste 23 kayıt / 3 sayfa.

const SAHTE_GIB_SIFRE = process.env['SAHTE_GIB_SIFRE'] ?? 'demo-gib-sifre';

async function firmaVeHesap(page: Page, gibKodu?: string) {
  const vkn = fakeVkn();
  await page.goto('/firmalar/kart/yeni');
  await page.getByLabel('Firma / mükellef unvanı').fill(`Tebligat ${Date.now()} Ltd`);
  await page.getByLabel('Firma türü').selectOption('Limited');
  await page.getByLabel('VKN / TCKN').fill(vkn);
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Firma eklendi.' })).toBeVisible();
  const id = page.url().match(/kart\/([0-9a-f-]{36})/)![1]!;
  await gibBilgileriniAc(page);
  await page.getByLabel('GİB kullanıcı kodu').fill(gibKodu ?? vkn);
  await page.getByLabel('GİB şifresi').fill(SAHTE_GIB_SIFRE);
  await page.getByRole('button', { name: 'GİB hesabını kaydet' }).click();
  await expect(page.getByText('GİB hesabı Vault’a kaydedildi.')).toBeVisible();
  return id;
}

async function onayKaydet(page: Page, id: string) {
  await page.goto(`/firmalar/kart/${id}`);
  await page.getByLabel('Mükelleften yazılı onay aldığımı beyan ederim.').check();
  await page.getByRole('button', { name: 'Onayı kaydet' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Mükellef onayı kaydedildi.' })).toBeVisible();
  await expect(page.getByText('Onay var')).toBeVisible();
}

test.describe('e-Tebligat', () => {
  test('@F:firmalar.kurum_hesaplari.consent @F:tebligat.liste.sync @F:tebligat.liste.view onay kaydedilince firmanın e-Tebligat listesi GİB\'den okunur; belge açılmaz; onay geri alınınca güncelleme kapanır', async ({ page, browser }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc(true);
    await girisYap(page, o.yonetici);
    const id = await firmaVeHesap(page);
    // Onay yokken firmanın hesabı kullanılmaz
    await page.goto(`/tebligat/liste?firma=${id}`);
    await expect(page.getByText(/önce firma kartında mükellef onayını kaydedin/)).toBeVisible();
    await expect(page.getByRole('button', { name: "e-Tebligat'ı GİB'den güncelle" })).toHaveCount(0);
    await onayKaydet(page, id);
    await ekranDenetle(page);
    await page.goto(`/tebligat/liste?firma=${id}`);
    await page.getByRole('button', { name: "e-Tebligat'ı GİB'den güncelle" }).click();
    const durum = page.getByRole('status').filter({ hasText: 'Son iş' });
    await expect(durum).toContainText('Tamamlandı', { timeout: 200_000 });
    await expect(durum).toContainText('23 tebligat');
    await expect(durum).toContainText('belge açılmadı');
    await page.reload();
    await expect(page.getByText('23 kayıt listeleniyor.')).toBeVisible();
    await expect(page.getByText('Okuma tarihi yok').first()).toBeVisible();
    await expect(page.getByText(/tebliğ edilmediği anlamına gelmez/)).toBeVisible();
    await ekranDenetle(page);
    expect(hatalar).toEqual([]);
    // Personel listeyi görebilir ama güncelleyemez (uç 403)
    const personel = await browser.newPage();
    await girisYap(personel, o.personel);
    await personel.goto('/tebligat/liste');
    await expect(personel.getByRole('button', { name: "e-Tebligat'ı GİB'den güncelle" })).toHaveCount(0);
    const csrf = await personel.locator('input[name="csrf"]').first().inputValue();
    const kod = await personel.evaluate(
      async ([c, f]) => (await fetch('/api/sync/etebligat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': c! }, body: JSON.stringify({ firmaId: f }) })).status,
      [csrf, id],
    );
    expect(kod).toBe(403);
    await personel.close();
    // Onay geri alınınca güncelleme kapanır
    await page.goto(`/firmalar/kart/${id}`);
    await page.getByRole('button', { name: 'Onayı geri al' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Mükellef onayı geri alındı.' })).toBeVisible();
    await page.goto(`/tebligat/liste?firma=${id}`);
    await expect(page.getByRole('button', { name: "e-Tebligat'ı GİB'den güncelle" })).toHaveCount(0);
  });

  test('@F:tebligat.liste.sync tüm mükelleflerin e-Tebligatı tek tuşla çekilir; onayı ya da GİB hesabı olmayan atlanır', async ({ page }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc(true);
    await girisYap(page, o.yonetici);
    // Hazır: onaylı + hesaplı (çekilir), hesaplı ama onaysız (atlanır), hesapsız (atlanır)
    const onayli = await firmaVeHesap(page);
    await onayKaydet(page, onayli);
    await firmaVeHesap(page);
    await page.goto('/firmalar/kart/yeni');
    await page.getByLabel('Firma / mükellef unvanı').fill(`Hesapsiz ${Date.now()} Ltd`);
    await page.getByLabel('Firma türü').selectOption('Limited');
    await page.getByLabel('VKN / TCKN').fill(fakeVkn());
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Firma eklendi.' })).toBeVisible();

    // Firma seçilmeden toplu çekim görünür; tek firma seçilince görünmez
    await page.goto('/tebligat/liste');
    const toplu = page.getByRole('button', { name: "Tüm mükelleflerin e-Tebligatını çek" });
    await expect(toplu).toBeVisible();
    await ekranDenetle(page);
    await toplu.click();
    const ozet = page.getByRole('status').filter({ hasText: 'güncelleme başlatıldı' });
    await expect(ozet).toContainText('1 mükellef için güncelleme başlatıldı');
    await expect(ozet).toContainText('2 atlandı');
    await expect(ozet).toContainText('mükellef onayı yok');
    await expect(ozet).toContainText('GİB hesabı yok');

    // Açılan iş tamamlanınca yalnız onaylı firmanın listesi dolar
    await page.goto(`/tebligat/liste?firma=${onayli}`);
    await expect(page.getByRole('status').filter({ hasText: 'Son iş' })).toContainText('Tamamlandı', { timeout: 200_000 });
    await page.reload();
    await expect(page.getByText('23 kayıt listeleniyor.')).toBeVisible();
    await expect(page.getByRole('button', { name: "Tüm mükelleflerin e-Tebligatını çek" })).toHaveCount(0);
    expect(hatalar).toEqual([]);
  });

  test('@F:tebligat.liste.sync açılan GİB hesabının kimliği firmanın VKN\'si değilse liste okunmaz', async ({ page }) => {
    const o = await ofisAc();
    await girisYap(page, o.yonetici);
    const id = await firmaVeHesap(page, '5550001234');
    await onayKaydet(page, id);
    await page.goto(`/tebligat/liste?firma=${id}`);
    await page.getByRole('button', { name: "e-Tebligat'ı GİB'den güncelle" }).click();
    const durum = page.getByRole('status').filter({ hasText: 'Son iş' });
    await expect(durum).toContainText('Başarısız', { timeout: 200_000 });
    await expect(durum).toContainText('kimliği firmanın VKN/TCKN numarasıyla doğrulanamadı');
    await expect(page.getByText('Kayıt yok.')).toBeVisible();
  });
});
