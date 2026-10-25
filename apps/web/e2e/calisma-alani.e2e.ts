import { expect, test } from '@playwright/test';
import { fakeVkn } from '@eworks/testing';
import { ofisAc } from './genel-kurulum.ts';
import { girisYap, hataTopla, tasmaYok } from './yardim.ts';

// Çalışma alanı: görevler (eski "Takvim ve Görevler"), notlar ve ana sayfa sayaçları. Her test kendi ofisini açar.

test.describe('çalışma alanı', () => {
  test('@F:gorevler.view @F:gorevler.create @F:gorevler.assign @F:gorevler.close @F:genel_bakis.panel.view yönetici görev atar, personel ilerletir, yönetici kapatır; ana sayfa sayaçları', async ({ browser }) => {
    const o = await ofisAc(true);
    const yonetici = await (await browser.newContext()).newPage();
    const hatalar = hataTopla(yonetici);
    await girisYap(yonetici, o.yonetici);
    await yonetici.goto('/gorevler');
    const baslik = `Ekim KDV kontrolü ${Date.now()}`;
    await yonetici.getByLabel('Görev başlığı').fill(baslik);
    await yonetici.getByLabel('Son tarih').fill('2026-10-01');
    await yonetici.locator('select[name="assigneeId"]').selectOption({ label: o.personel.ad });
    await yonetici.getByRole('button', { name: 'Görevi kaydet' }).click();
    await expect(yonetici.getByRole('status')).toHaveText('Görev oluşturuldu.');
    const satir = yonetici.getByRole('row', { name: new RegExp(baslik) });
    await expect(satir).toContainText(o.personel.ad);
    await expect(satir).toContainText('Gecikti');
    await tasmaYok(yonetici);

    const personel = await (await browser.newContext()).newPage();
    await girisYap(personel, o.personel);
    await personel.goto('/gorevler?bana=1');
    const pSatir = personel.getByRole('row', { name: new RegExp(baslik) });
    await expect(pSatir).toBeVisible();
    // Sorumlu personel görevi ilerletir (rol şablonu: görev modülü)
    await Promise.all([personel.waitForResponse((y) => y.url().endsWith('/durum') && y.ok()), pSatir.getByLabel('Durum').selectOption('Devam Ediyor')]);
    await expect(pSatir.getByLabel('Durum')).toHaveValue('Devam Ediyor');

    await yonetici.reload();
    await Promise.all([yonetici.waitForResponse((y) => y.url().endsWith('/durum') && y.ok()), satir.getByLabel('Durum').selectOption('Tamamlandı')]);
    await yonetici.reload();
    await expect(yonetici.getByRole('row', { name: new RegExp(baslik) }).getByLabel('Durum')).toHaveValue('Tamamlandı');

    await yonetici.goto('/');
    await expect(yonetici.locator('.sayac', { hasText: 'Açık görev' })).toBeVisible();
    await expect(yonetici.locator('.sayac', { hasText: 'Firma' }).first()).toBeVisible();
    await tasmaYok(yonetici);
    expect(hatalar).toEqual([]);
  });

  test('@F:notlar.view @F:notlar.create firmaya not eklenir; personel atanmadığı firmanın notunu görmez', async ({ page }) => {
    const o = await ofisAc(true);
    await girisYap(page, o.yonetici);
    const unvan = `Not Ltd ${Date.now()}`;
    await page.goto('/firmalar/kart/yeni');
    await page.getByLabel('Firma / mükellef unvanı').fill(unvan);
    await page.getByLabel('Firma türü').selectOption('Limited');
    await page.getByLabel('VKN / TCKN').fill(fakeVkn());
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Firma eklendi.');
    await page.goto('/notlar');
    await page.getByLabel('Mükellef').first().selectOption({ label: unvan });
    await page.getByLabel('Not', { exact: true }).fill('Ekim KDV için fatura listesi bekleniyor.');
    await page.getByRole('button', { name: 'Notu kaydet' }).click();
    await expect(page.getByRole('status')).toHaveText('Not eklendi.');
    await expect(page.getByRole('list', { name: 'Notlar' })).toContainText('Ekim KDV için fatura listesi bekleniyor.');
    await tasmaYok(page);
    await page.context().clearCookies();
    await girisYap(page, o.personel);
    await page.goto('/notlar');
    await expect(page.getByRole('list', { name: 'Notlar' })).toContainText('Not yok.');
  });
});
