import { expect, test } from '@playwright/test';
import { ShardRouter } from '@eworks/platform';
import { yigin } from '@eworks/testing';
import { BundledCalendarSources, ensureCalendarYear, PgCalendarRepository } from '@eworks/workspace';
import { ofisAc } from './genel-kurulum.ts';
import { ekranDenetle, girisYap, hataTopla } from './yardim.ts';

// Mali müşavir takvimi (workspace): işçinin dolduracağı yıl test başında aynı use-case ile doldurulur (işçinin 10 dk döngüsünü
// beklememek için); sonra kullanıcı gözünden ay/gün/liste görünümü, süzgeç ve ofis yöneticisinin tarih düzeltmesi.

async function takvimiDoldur(org: string) {
  const router = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));
  try {
    const r = await ensureCalendarYear({ org }, 2026, { repo: new PgCalendarRepository(router), sources: new BundledCalendarSources() });
    if (!r.ok) throw new Error(r.error);
  } finally {
    await router.end();
  }
}

test.describe('takvim', () => {
  test('@F:genel_bakis.takvim.view ana sayfadan takvim açılır; ay görünümünde tatil ve GİB tarihleri, gün görünümünde kaynak ve kesinlik görünür', async ({ page }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc(true);
    await takvimiDoldur(o.orgId);
    await girisYap(page, o.personel);
    await page.getByRole('navigation', { name: 'Kategoriler' }).getByRole('link', { name: /Takvim/ }).click();
    await expect(page).toHaveURL(/\/genel_bakis\/takvim$/);
    await page.goto('/genel_bakis/takvim?gorunum=ay&tarih=2026-10-15');
    await expect(page.getByRole('heading', { level: 2, name: 'Ekim 2026' })).toBeVisible();
    const ay = page.getByRole('table', { name: 'Ekim 2026 takvimi' });
    await expect(ay.getByRole('link', { name: /29 Ekim 2026 Perşembe/ })).toBeVisible();
    await ekranDenetle(page);
    await ay.getByRole('link', { name: /26 Ekim 2026 Pazartesi/ }).click();
    await expect(page).toHaveURL(/gorunum=gun&tarih=2026-10-26/);
    await expect(page.getByText('Konaklama Vergisi Beyan ve Ödemesi')).toBeVisible();
    await expect(page.getByText(/Kaynak: GİB vergi takvimi/).first()).toBeVisible();
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2026-11-02');
    const prim = page.getByRole('listitem').filter({ hasText: 'SGK prim ödemesi son günü' });
    await expect(prim.getByText('Kesinleşmedi')).toBeVisible();
    await expect(prim.getByText(/5510 sayılı Kanun md\. 88/)).toBeVisible();
    await ekranDenetle(page);
    expect(hatalar).toEqual([]);
    // Personel tarihi düzeltemez: düğme yok, uç 403 (bilerek yapılan yasak istek konsolda 403 olarak görünür; hata denetimi bundan önce)
    await expect(page.getByRole('button', { name: 'Tarihi düzelt' })).toHaveCount(0);
    const csrf = await page.locator('input[name="csrf"]').first().inputValue();
    const durum = await page.evaluate(
      async (c) => (await fetch('/api/takvim', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': c }, body: JSON.stringify({ id: 'kural:sgk-prim:2026-09', date: '2026-11-03' }) })).status,
      csrf,
    );
    expect(durum).toBe(403);
  });

  test('@F:genel_bakis.takvim.view süzgeç: yalnız resmî tatiller; liste görünümü', async ({ page }) => {
    const o = await ofisAc();
    await takvimiDoldur(o.orgId);
    await girisYap(page, o.yonetici);
    await page.goto('/genel_bakis/takvim?gorunum=liste&tarih=2026-10-01');
    await page.getByRole('group', { name: 'Kaynak' }).getByLabel('Resmî tatiller').check();
    await page.getByRole('button', { name: 'Süz', exact: true }).click();
    await expect(page).toHaveURL(/kaynak=tatil/);
    await expect(page.getByText('Cumhuriyet Bayramı', { exact: true })).toBeVisible();
    await expect(page.getByText('Katma Değer Vergisinin Beyan ve Ödemesi')).toHaveCount(0);
    await ekranDenetle(page);
  });

  test('@F:genel_bakis.takvim.remind takvim kaydından hatırlatma eklenir, yaklaşanlarda ve ana sayfada görünür, tamamlanır, silinir; başka kullanıcı görmez', async ({ page, browser }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc(true);
    await takvimiDoldur(o.orgId);
    await girisYap(page, o.yonetici);
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2026-11-02');
    await page.getByRole('link', { name: 'SGK prim ödemesi son günü için hatırlatma ekle' }).click();
    await expect(page.getByLabel('Başlık')).toHaveValue('SGK prim ödemesi son günü');
    await expect(page.getByLabel('Tarih', { exact: true })).toHaveValue('2026-11-02');
    await page.getByLabel('Kategori').selectOption('sgk');
    await page.getByRole('textbox', { name: 'Not' }).fill('Eylül primleri');
    await page.getByRole('button', { name: 'Hatırlatmayı kaydet' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Hatırlatma eklendi.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Yeni hatırlatma' })).toHaveCount(0);
    const kisisel = page.locator('li.kat-kisisel').filter({ hasText: 'SGK prim ödemesi son günü' });
    await expect(kisisel.getByText('Kişisel · SGK')).toBeVisible();
    await expect(kisisel.getByText('Eylül primleri')).toBeVisible();
    await ekranDenetle(page);

    // Bugün için (aynı gün) hatırlatma: yaklaşanlarda ve ana sayfa sayacında
    const bugun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
    await page.goto(`/genel_bakis/takvim?gorunum=gun&tarih=${bugun}`);
    await page.getByRole('button', { name: 'Hatırlatma ekle' }).first().click();
    await page.getByLabel('Başlık').fill('Müşteri toplantısı');
    await page.getByLabel('Tarih', { exact: true }).fill(bugun);
    await page.getByLabel('Saat (isteğe bağlı)').fill('14:30');
    await page.getByRole('combobox', { name: /^Hatırlatma/ }).selectOption('0');
    await page.getByRole('button', { name: 'Hatırlatmayı kaydet' }).click();
    const yaklasan = page.getByRole('region', { name: 'Yaklaşan hatırlatmalar' });
    await expect(yaklasan.getByText('Müşteri toplantısı')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Yaklaşan hatırlatma/ })).toContainText(/[1-9]/);

    // Başka kullanıcı (aynı ofisin personeli) görmez
    const diger = await browser.newPage();
    await girisYap(diger, o.personel);
    await diger.goto(`/genel_bakis/takvim?gorunum=gun&tarih=${bugun}`);
    await expect(diger.getByText('Müşteri toplantısı')).toHaveCount(0);
    await diger.close();

    await page.goto(`/genel_bakis/takvim?gorunum=gun&tarih=${bugun}`);
    await yaklasan.getByRole('button', { name: 'Müşteri toplantısı: tamamlandı' }).click();
    await expect(page.getByRole('region', { name: 'Yaklaşan hatırlatmalar' })).toHaveCount(0);
    const tamam = page.locator('li.kat-kisisel').filter({ hasText: 'Müşteri toplantısı' });
    await expect(tamam.getByText('Tamamlandı', { exact: true })).toBeVisible();
    await tamam.getByRole('button', { name: 'Müşteri toplantısı: sil' }).click();
    await expect(page.locator('li.kat-kisisel').filter({ hasText: 'Müşteri toplantısı' })).toHaveCount(0);
    expect(hatalar).toEqual([]);
  });

  test('@F:genel_bakis.takvim.sync yönetici yılın takvimini kaynaklardan günceller: GİB vergi takvimi ve kesinleşmemiş bayramlar gelir; personel başlatamaz', async ({ page, browser }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc(true);
    await girisYap(page, o.yonetici);
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2027-01-28');
    await page.getByRole('button', { name: '2027 takvimini kaynaklardan güncelle' }).click();
    const durum = page.getByRole('status').filter({ hasText: 'Son iş' });
    await expect(durum).toContainText('Tamamlandı', { timeout: 120_000 });
    await expect(durum).toContainText('GİB kaydı');
    await expect(durum).toContainText('sahte GİB');
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2027-01-28');
    await expect(page.getByText('Katma Değer Vergisinin Beyan ve Ödemesi', { exact: true })).toBeVisible();
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2027-03-10');
    const bayram = page.getByRole('listitem').filter({ hasText: 'Ramazan Bayramı 1. gün' });
    await expect(bayram.getByText('Kesinleşmedi')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Ramazan Bayramı arifesi' }).first()).toHaveCount(0);
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2027-03-09');
    await expect(page.getByText('Ramazan Bayramı arifesi (13.00 sonrası)')).toBeVisible();
    await ekranDenetle(page);
    expect(hatalar).toEqual([]);
    const personel = await browser.newPage();
    await girisYap(personel, o.personel);
    await personel.goto('/genel_bakis/takvim?gorunum=gun&tarih=2027-01-28');
    await expect(personel.getByRole('button', { name: /kaynaklardan güncelle/ })).toHaveCount(0);
    await personel.close();
  });

  test('@F:genel_bakis.takvim.edit ofis yöneticisi kesinleşmemiş tarihi düzeltir; düzeltme kaynağı ve eski tarihi gösterir; kaldırılabilir', async ({ page }) => {
    const hatalar = hataTopla(page);
    const o = await ofisAc();
    await takvimiDoldur(o.orgId);
    await girisYap(page, o.yonetici);
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2026-11-02');
    const prim = page.getByRole('listitem').filter({ hasText: 'SGK prim ödemesi son günü' });
    await prim.getByLabel('Doğru tarih').fill('2026-11-03');
    await prim.getByRole('button', { name: 'Tarihi düzelt' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Tarih düzeltildi.' })).toBeVisible();
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2026-11-03');
    const duzeltilen = page.getByRole('listitem').filter({ hasText: 'SGK prim ödemesi son günü' });
    await expect(duzeltilen.getByText(/ofis düzeltmesi \(kaynak tarihi 02\.11\.2026\)/)).toBeVisible();
    await expect(duzeltilen.getByText('Kesin', { exact: true })).toBeVisible();
    await ekranDenetle(page);
    await duzeltilen.getByRole('button', { name: 'Düzeltmeyi kaldır' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Düzeltme kaldırıldı.' })).toBeVisible();
    await page.goto('/genel_bakis/takvim?gorunum=gun&tarih=2026-11-02');
    await expect(page.getByRole('listitem').filter({ hasText: 'SGK prim ödemesi son günü' })).toBeVisible();
    expect(hatalar).toEqual([]);
  });
});
