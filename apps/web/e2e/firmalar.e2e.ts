import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { fakeVkn } from '@eworks/testing';
import { ekranDenetle, gibBilgileriniAc, girisYap, hataTopla, kullanicilar } from './yardim.ts';

// Firmalarım (portfolio) ve kurum hesapları (credentials) kabul testleri — eski portalın firma ekranının karşılığı.

async function firmaEkle(page: Page, unvan: string, vkn: string) {
  await page.goto('/firmalar/kart/yeni');
  await page.getByLabel('Firma / mükellef unvanı').fill(unvan);
  await page.getByLabel('Firma türü').selectOption('Limited');
  await page.getByLabel('VKN / TCKN').fill(vkn);
  await page.getByLabel('Vergi dairesi').fill('Kadıköy');
  await page.getByLabel('İl').fill('İstanbul');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Firma eklendi.');
  return page.url().match(/kart\/([0-9a-f-]{36})/)![1]!;
}

test.describe('firmalar', () => {
  test('@F:firmalar.kart.create @F:firmalar.kart.view @F:firmalar.liste.view yönetici firma ekler, kartını ve listede görür', async ({ page }) => {
    const hatalar = hataTopla(page);
    await girisYap(page, kullanicilar().yonetici);
    const unvan = `Kabul Gıda ${Date.now()} Ltd. Şti.`;
    await firmaEkle(page, unvan, fakeVkn());
    await expect(page.getByLabel('Firma / mükellef unvanı')).toHaveValue(unvan);
    await ekranDenetle(page);
    await page.goto(`/firmalar/liste?q=${encodeURIComponent(unvan)}`);
    await expect(page.getByRole('link', { name: unvan, exact: true })).toBeVisible();
    await expect(page.getByText('1 kayıt listeleniyor.')).toBeVisible();
    await ekranDenetle(page);
    expect(hatalar).toEqual([]);
  });

  test('@F:firmalar.kart.create geçersiz ve sistemde kayıtlı VKN reddedilir', async ({ page }) => {
    await girisYap(page, kullanicilar().yonetici);
    const vkn = fakeVkn();
    await firmaEkle(page, `İlk ${Date.now()} Ltd`, vkn);
    await page.goto('/firmalar/kart/yeni');
    await page.getByLabel('Firma / mükellef unvanı').fill('İkinci Ltd');
    await page.getByLabel('VKN / TCKN').fill(vkn);
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Bu VKN/TCKN ile kayıtlı bir mükellef zaten var.');
    await page.getByLabel('VKN / TCKN').fill(vkn.slice(0, 9) + String((Number(vkn[9]) + 1) % 10));
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await expect(page.getByText('VKN (10 hane) ya da TCKN (11 hane) geçersiz.')).toBeVisible();
    await ekranDenetle(page);
  });

  test('@F:firmalar.kart.edit @F:firmalar.kart.view kart düzenlenir ve kaydedilir', async ({ page }) => {
    await girisYap(page, kullanicilar().yonetici);
    const id = await firmaEkle(page, `Düzenlenecek ${Date.now()} Ltd`, fakeVkn());
    await page.getByLabel('Yetkili').fill('Zeynep Kaya');
    await page.getByLabel('Firma onay durumu').selectOption('Aktif');
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Firma bilgileri kaydedildi.');
    await page.goto(`/firmalar/kart/${id}`);
    await expect(page.getByLabel('Yetkili')).toHaveValue('Zeynep Kaya');
    await expect(page.getByLabel('Firma onay durumu')).toHaveValue('Aktif');
  });

  test('@F:firmalar.liste.view yazarken arama Türkçe harf farkını yok sayar; Düzenle kartı açar; G/S/V yalnız doğrulanınca yeşil', async ({ page }) => {
    const hatalar = hataTopla(page);
    await girisYap(page, kullanicilar().yonetici);
    const ek = String(Date.now());
    const unvan = `Çağlayan Gıda ${ek} Ltd. Şti.`;
    const id = await firmaEkle(page, unvan, fakeVkn());
    await gibBilgileriniAc(page);
    await page.getByLabel('GİB kullanıcı kodu').fill('1234567');
    await page.getByLabel('GİB şifresi').fill(`Gib-${ek}`);
    await page.getByRole('button', { name: 'GİB hesabını kaydet' }).click();
    await expect(page.getByText('GİB hesabı Vault’a kaydedildi.')).toBeVisible();
    await page.goto('/firmalar/liste');
    const ara = page.getByRole('searchbox', { name: 'Ara' });
    await ara.click();
    await ara.pressSequentially(`caglayan gida ${ek}`);
    await expect(page).toHaveURL(/q=caglayan/);
    await expect(page.getByText('1 kayıt listeleniyor.')).toBeVisible();
    await expect(ara).toBeFocused();
    await expect(ara).toHaveValue(`caglayan gida ${ek}`);
    const satir = page.getByRole('row').filter({ hasText: unvan });
    // Şifrenin kayıtlı olması kurumda doğrulandığı anlamına gelmez: G gri kalır
    await expect(satir.getByTitle('GİB erişimi: Doğrulanmadı')).toBeVisible();
    await expect(satir.getByTitle('SGK erişimi: Doğrulanmadı')).toBeVisible();
    await expect(satir.getByTitle('Vergi levhası: Doğrulanmadı')).toBeVisible();
    await ekranDenetle(page);
    await satir.getByRole('link', { name: /düzenle$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/firmalar/kart/${id}$`));
    await expect(page.getByRole('group', { name: 'Temel bilgiler' }).getByLabel('Firma / mükellef unvanı')).toHaveValue(unvan);
    await expect(page.getByRole('group', { name: 'Firma ve sorumlu bilgileri' }).getByLabel('Firma türü')).toHaveValue('Limited');
    await ekranDenetle(page);
    expect(hatalar).toEqual([]);
  });

  test('@F:firmalar.liste.export firma listesi CSV olarak iner', async ({ page }) => {
    await girisYap(page, kullanicilar().yonetici);
    const unvan = `CSV ${Date.now()} Ltd`;
    await firmaEkle(page, unvan, fakeVkn());
    await page.goto(`/firmalar/liste?q=${encodeURIComponent(unvan)}`);
    const [indirme] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'CSV indir' }).click()]);
    expect(indirme.suggestedFilename()).toMatch(/^Eworks_Firmalar_\d{4}-\d{2}-\d{2}\.csv$/);
    const icerik = readFileSync((await indirme.path())!, 'utf8');
    expect(icerik.startsWith('﻿"Unvan";"Tür";"VKN/TCKN"')).toBe(true);
    expect(icerik).toContain(`"${unvan}"`);
    expect(icerik.trim().split('\r\n')).toHaveLength(2);
  });

  test('@F:firmalar.kurum_hesaplari.edit_credentials @F:firmalar.kurum_hesaplari.view_status firmanın ve müşavirin GİB hesabı kaydedilir; şifre geri gelmez', async ({ page }) => {
    await girisYap(page, kullanicilar().yonetici);
    const unvan = `Hesap ${Date.now()} Ltd`;
    await firmaEkle(page, unvan, fakeVkn());
    await expect(page.getByText('GİB hesabı durumu: Kayıtlı değil')).toBeVisible();
    const sifre = `Gib-${Date.now()}-sifre`;
    // Otomatik doldurma kilidi: alanlar düğmeyle açılana dek sayfada yok, açılınca boş ve odaklı
    await expect(page.getByLabel('GİB şifresi')).toHaveCount(0);
    await gibBilgileriniAc(page);
    await expect(page.getByLabel('GİB kullanıcı kodu')).toBeFocused();
    await expect(page.getByLabel('GİB kullanıcı kodu')).toHaveValue('');
    await page.getByLabel('GİB kullanıcı kodu').fill('1234567');
    await page.getByLabel('GİB şifresi').fill(sifre);
    await page.getByRole('button', { name: 'GİB hesabını kaydet' }).click();
    await expect(page.getByText('GİB hesabı Vault’a kaydedildi.')).toBeVisible();
    await expect(page.getByLabel('GİB şifresi')).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(/GİB hesabı durumu: Kayıtlı/)).toBeVisible();
    await gibBilgileriniAc(page);
    await expect(page.getByLabel('GİB kullanıcı kodu')).toHaveValue('');
    await expect(page.getByLabel('GİB şifresi')).toHaveValue('');
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await expect(page.getByLabel('GİB şifresi')).toHaveCount(0);
    expect(await page.content()).not.toContain(sifre);
    await page.goto('/firmalar/kurum_hesaplari');
    await expect(page.getByRole('row', { name: new RegExp(unvan) })).toContainText('Kayıtlı');
    await gibBilgileriniAc(page);
    await page.getByLabel('GİB kullanıcı kodu').fill('7654321');
    await page.getByLabel('GİB şifresi').fill(sifre);
    await page.getByRole('button', { name: 'GİB hesabını kaydet' }).click();
    await expect(page.getByText('GİB hesabı Vault’a kaydedildi.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Müşavir GİB hesabınız: Kayıtlı', { exact: true })).toBeVisible();
    await ekranDenetle(page);
  });

  test('@F:firmalar.kurum_hesaplari.edit_credentials firmanın SGK işyerleri ve UETS hesabı Vault\'a kaydedilir; e-Devlet şifresi saklanmaz', async ({ page }) => {
    const hatalar = hataTopla(page);
    await girisYap(page, kullanicilar().yonetici);
    await firmaEkle(page, `Kurum Kartı ${Date.now()} Ltd`, fakeVkn());
    const bolum = page.getByRole('region', { name: 'Kurum ve mükellef bilgileri' });
    await expect(bolum.getByText('Kayıtlı SGK işyeri hesabı yok.')).toBeVisible();
    await expect(bolum.getByText('e-Devlet şifresi Eworks\'te saklanmaz.')).toBeVisible();
    const sir = `Sgk-${Date.now()}-sir`;
    for (const isyeri of ['Merkez', 'Şube']) {
      await bolum.getByRole('button', { name: 'SGK işyeri ekle' }).click();
      await expect(page.getByLabel('İşyeri adı')).toBeFocused();
      await page.getByLabel('İşyeri adı').fill(isyeri);
      await page.getByLabel('SGK kullanıcı adı').fill('12345678901');
      await page.getByLabel('İşyeri kodu').fill('0001');
      await page.getByLabel('Sistem şifresi').fill(sir);
      await page.getByLabel('İşyeri şifresi').fill(`${sir}-isyeri`);
      await page.getByRole('button', { name: 'SGK hesabını kaydet' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'SGK hesabı Vault’a kaydedildi.' }).last()).toBeVisible();
      await expect(page.locator(`[data-isyeri="${isyeri}"]`)).toBeVisible();
    }
    // Kayıtlı işyerinin bilgileri boş açılır ve yerinde güncellenir; işyeri sayısı artmaz
    await page.getByRole('button', { name: 'Merkez bilgilerini değiştir' }).click();
    await expect(page.getByLabel('İşyeri adı')).toHaveCount(0);
    await expect(page.getByLabel('SGK kullanıcı adı')).toHaveValue('');
    await page.getByLabel('SGK kullanıcı adı').fill('12345678901');
    await page.getByLabel('İşyeri kodu').fill('0002');
    await page.getByLabel('Sistem şifresi').fill(`${sir}-yeni`);
    await page.getByLabel('İşyeri şifresi').fill(`${sir}-isyeri`);
    await page.getByRole('button', { name: 'SGK hesabını kaydet' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'SGK hesabı Vault’a kaydedildi.' }).last()).toBeVisible();
    await expect(page.locator('[data-isyeri]')).toHaveCount(2);
    await bolum.getByRole('button', { name: 'UETS bilgilerini gir' }).click();
    await page.getByLabel('UETS adresi').fill('ornek-uets-adresi');
    await page.getByLabel('UETS şifresi').fill(`${sir}-uets`);
    await page.getByRole('button', { name: 'UETS hesabını kaydet' }).click();
    await expect(page.getByText('UETS hesabı Vault’a kaydedildi.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('UETS hesabı durumu: Kayıtlı', { exact: false })).toBeVisible();
    await expect(page.locator('[data-isyeri="Şube"]').getByText('Kurumda: Doğrulanmadı')).toBeVisible();
    const icerik = await page.content();
    for (const s of [sir, `${sir}-isyeri`, `${sir}-yeni`, `${sir}-uets`, '12345678901', 'ornek-uets-adresi']) expect(icerik).not.toContain(s);
    await ekranDenetle(page);
    expect(hatalar).toEqual([]);
  });

  test('@F:firmalar.kart.archive arşivlenen firma listeden kalkar', async ({ page }) => {
    await girisYap(page, kullanicilar().yonetici);
    const unvan = `Arşiv ${Date.now()} Ltd`;
    await firmaEkle(page, unvan, fakeVkn());
    await page.getByRole('button', { name: 'Arşivle' }).click();
    await page.getByRole('button', { name: 'Evet, arşivle' }).click();
    await expect(page.getByRole('status')).toHaveText('Firma arşivlendi.');
    await page.goto(`/firmalar/liste?q=${encodeURIComponent(unvan)}`);
    await expect(page.getByText('Kayıt bulunamadı.')).toBeVisible();
  });

  test('personel firma ekleyemez (düğme yok, uç 403) ve atanmadığı firmaları görmez', async ({ page }) => {
    await girisYap(page, kullanicilar().personel);
    await page.goto('/firmalar/liste');
    await expect(page.getByRole('link', { name: 'Yeni firma' })).toHaveCount(0);
    await expect(page.getByText('Kayıt bulunamadı.')).toBeVisible();
    const csrf = await page.locator('input[name="csrf"]').first().inputValue();
    const durum = await page.evaluate(
      async (c) =>
        (await fetch('/api/firmalar', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': c }, body: JSON.stringify({ title: 'X', kind: 'Limited', taxId: '0000000000' }) })).status,
      csrf,
    );
    expect(durum).toBe(403);
    await page.goto('/firmalar/kart/yeni');
    await expect(page.getByRole('heading', { name: 'Yetkiniz yok' })).toBeVisible();
  });

  test('başka ofisin firma kartı 404; CSRF belirteci olmadan değişiklik reddedilir', async ({ page }) => {
    await girisYap(page, kullanicilar().yonetici);
    const r = await page.request.get(`/firmalar/kart/00000000-0000-4000-8000-000000000000`);
    expect(r.status()).toBe(404);
    const durum = await page.evaluate(async () => (await fetch('/api/firmalar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
    expect(durum).toBe(403);
  });
});
