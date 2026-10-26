import { expect, test } from '@playwright/test';
import { ekranDenetle, girisYap, hataTopla, kullanicilar } from './yardim.ts';

test.describe('oturum', () => {
  test('@F:oturum.giris.login ofis kullanıcısı giriş yapar, panelde ofisini görür, çıkış yapar', async ({ page }) => {
    const hatalar = hataTopla(page);
    const k = kullanicilar();
    await page.goto('/');
    await expect(page).toHaveURL(/\/giris$/);
    await ekranDenetle(page);
    await girisYap(page, k.yonetici);
    await expect(page.getByText(k.ofisAdi)).toBeVisible();
    await expect(page.getByText(k.yonetici.ad)).toBeVisible();
    await ekranDenetle(page);
    // Oturum çerezi HttpOnly; belirteçler tarayıcıda yok (D5)
    const cerez = (await page.context().cookies()).find((c) => c.name.endsWith('ew_sid'));
    expect(cerez?.httpOnly).toBe(true);
    expect(cerez?.sameSite).toBe('Strict');
    expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie)).not.toMatch(/eyJ|access_token|ew_sid/);
    await page.getByRole('button', { name: 'Çıkış' }).click();
    await expect(page).toHaveURL(/\/giris$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/giris$/);
    expect(hatalar).toEqual([]);
  });

  test('@F:oturum.giris.login yanlış parola reddedilir; neden ayrıntılandırılmaz', async ({ page }) => {
    const k = kullanicilar();
    await page.goto('/giris');
    await page.getByLabel('E-posta').fill(k.yonetici.eposta);
    await page.getByLabel('Parola').fill('yanlis-parola-12345');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.getByRole('alert')).toHaveText('E-posta ya da parola hatalı.');
    await page.getByLabel('E-posta').fill('olmayan@eworks.test');
    await page.getByLabel('Parola').fill('yanlis-parola-12345');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.getByRole('alert')).toHaveText('E-posta ya da parola hatalı.');
  });

  test('sayfalar güvenlik başlıklarıyla gelir (nonce\'lu CSP, çerçeveleme yok)', async ({ request }) => {
    const r = await request.get('/giris');
    const csp = r.headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(r.headers()['x-frame-options']).toBe('DENY');
    expect(r.headers()['x-powered-by']).toBeUndefined();
  });

  test('başka kökenden gelen giriş isteği reddedilir (CSRF)', async ({ request }) => {
    const k = kullanicilar();
    const r = await request.post('/api/oturum/giris', {
      form: { eposta: k.yonetici.eposta, parola: k.yonetici.parola },
      headers: { origin: 'https://saldirgan.example.com' },
      maxRedirects: 0,
    });
    expect(r.status()).toBe(303);
    expect(r.headers()['location']).toBe('/giris?hata=kaynak');
    expect(r.headers()['set-cookie'] ?? '').not.toContain('ew_sid');
  });
});

test.describe('menü ve yetki', () => {
  test('personel ana sayfadan kategoriye, oradan yalnız yetkili modüllere gider; yetkisiz sayfada 403 görünümü', async ({ page }) => {
    const hatalar = hataTopla(page);
    const k = kullanicilar();
    await girisYap(page, k.personel);
    const kategoriler = page.getByRole('navigation', { name: 'Kategoriler' });
    await expect(kategoriler.getByRole('link', { name: /Günlük Yönetim/ })).toBeVisible();
    await ekranDenetle(page);
    await kategoriler.getByRole('link', { name: /Günlük Yönetim/ }).click();
    await expect(page).toHaveURL(/\/kategori\/gunluk$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Günlük Yönetim' })).toBeVisible();
    await expect(page.locator('[data-modul="firmalar"]')).toBeVisible();
    await expect(page.locator('[data-modul="oturum"]')).toHaveCount(0);
    await ekranDenetle(page);
    // Modül kartından sayfaya, sayfadan "← Günlük Yönetim" ile kategoriye dönülür
    // Personelin modülün tamamına değil alt sayfalarına yetkisi var: modül sayfası yine açılır, yalnız yetkili sayfalar listelenir
    await page.locator('[data-modul="firmalar"]').click();
    await expect(page.getByRole('heading', { level: 1, name: /Firmalarım/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Firma listesi/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Müşavir devri/ })).toHaveCount(0);
    await page.getByRole('link', { name: /Günlük Yönetim/ }).first().click();
    await expect(page).toHaveURL(/\/kategori\/gunluk$/);
    await page.goto('/kategori/ofis');
    await expect(page.locator('[data-modul="yonetim"]')).toHaveCount(0);
    await page.goto('/kategori/olmayan');
    await expect(page.getByRole('heading', { name: /bulunamadı/i })).toBeVisible();
    // Portal içindeki 404'te üst çubuk (çıkış dahil) yerinde kalır
    await expect(page.getByRole('button', { name: 'Çıkış' })).toBeVisible();
    await ekranDenetle(page);
    await page.goto('/yonetim/kullanicilar');
    await expect(page.getByRole('heading', { name: 'Yetkiniz yok' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ana sayfaya dön' })).toBeVisible();
    await ekranDenetle(page);
    expect(hatalar.filter((h) => !h.includes('404'))).toEqual([]);
  });

  test('çok sayfalı modül alt sayfa kartlarıyla açılır; kartlar özellik durumunu gösterir', async ({ page }) => {
    const k = kullanicilar();
    await girisYap(page, k.yonetici);
    await page.goto('/kategori/gunluk');
    await page.locator('[data-modul="beyanname"]').click();
    await expect(page).toHaveURL(/\/beyanname$/);
    await expect(page.getByRole('link', { name: /e-Beyanname görüntüleme/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pilot bölge ayarları/ }).locator('.rozet.kirmizi')).toBeVisible();
    await ekranDenetle(page);
    // Alt sayfadan dönüş modül sayfasınadır (kardeş sayfaya bir tıkla geçilir)
    await page.getByRole('link', { name: /e-Beyanname görüntüleme/ }).click();
    await expect(page).toHaveURL(/\/beyanname\/liste/);
    await page.getByRole('link', { name: 'e-Beyanname', exact: true }).click();
    await expect(page).toHaveURL(/\/beyanname$/);
    await page.goto('/kategori/odeme');
    await expect(page.getByRole('link', { name: /Cari kasa/ })).toBeVisible();
    await ekranDenetle(page);
  });

  test('tamamlanmamış bölüm herkese kırmızı "Geliştiriliyor" olarak görünür (D30)', async ({ page }) => {
    const k = kullanicilar();
    await girisYap(page, k.yonetici);
    await page.goto('/odeme/aylik_liste');
    await expect(page.getByRole('heading', { name: /Aylık ödeme listesi/ })).toBeVisible();
    await expect(page.locator('h1 .rozet.kirmizi')).toContainText('Geliştiriliyor');
    await ekranDenetle(page);
  });
});
