import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { ekranDenetle, hataTopla, parolaGir, satisciAc, satisciHazirla, uyari } from './yardim.ts';

// Satış portalı kabul testleri (D27, D40): satışçı girişi zorunlu 2FA ile, ofis listesi, yeni ofis (+ müşavirin portala girişi).

test.describe('satış girişi', () => {
  test('@F:satis.oturum.login @F:satis.oturum.mfa ilk giriş: 2FA kurulur, kurtarma kodları bir kez görünür, geçici parola değiştirilir; çerez HttpOnly', async ({ page }) => {
    const hatalar = hataTopla(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/giris$/);
    await ekranDenetle(page);
    const s = await satisciHazirla(page, true);
    expect(s.kurtarma).toHaveLength(10);
    await ekranDenetle(page);
    const cerez = (await page.context().cookies()).find((c) => c.name.endsWith('ew_satis_sid'));
    expect(cerez?.httpOnly).toBe(true);
    expect(cerez?.sameSite).toBe('Strict');
    expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie)).not.toMatch(/ew_satis|otpauth/);
    await page.getByRole('button', { name: 'Çıkış' }).click();
    await expect(page).toHaveURL(/\/giris$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/giris$/);
    expect(hatalar).toEqual([]);
  });

  test('@F:satis.oturum.mfa ikinci giriş kod ister; yanlış kod reddedilir; kurtarma kodu bir kez geçer', async ({ page, context }) => {
    const s = await satisciHazirla(page);
    await context.clearCookies();
    await parolaGir(page, s.eposta, s.parola);
    await expect(page).toHaveURL(/\/giris\/dogrula$/);
    await ekranDenetle(page);
    await page.getByLabel('Doğrulama kodu').fill('000000');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(uyari(page)).toContainText('Kod hatalı');
    await page.getByText('Telefonuma erişemiyorum').click();
    await page.getByLabel('Kurtarma kodu').fill(s.kurtarma[0] ?? '');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ofisler' })).toBeVisible();
    // Kullanılmış kurtarma kodu ikinci kez geçmez
    await context.clearCookies();
    await parolaGir(page, s.eposta, s.parola);
    await page.getByText('Telefonuma erişemiyorum').click();
    await page.getByLabel('Kurtarma kodu').fill(s.kurtarma[0] ?? '');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(uyari(page)).toContainText('Kod hatalı');
  });

  test('@F:satis.oturum.login yanlış parola ve olmayan e-posta aynı mesajı alır; ara adım çerezi olmadan kod ekranı açılmaz', async ({ page }) => {
    const { eposta } = await satisciAc();
    for (const e of [eposta, 'olmayan-satisci@eworks.test']) {
      await parolaGir(page, e, 'yanlis-parola-12345');
      await expect(uyari(page)).toHaveText('E-posta ya da parola hatalı. Art arda 5 hatalı denemede hesap 15 dakika kilitlenir.');
    }
    await page.goto('/giris/dogrula');
    await expect(page).toHaveURL(/\/giris$/);
    await page.goto('/giris/kurulum');
    await expect(page).toHaveURL(/\/giris$/);
  });

  test('başka kökenden gelen giriş isteği reddedilir; güvenlik başlıkları var', async ({ request }) => {
    const { eposta, geciciParola } = await satisciAc();
    const r = await request.post('/api/oturum/giris', { form: { eposta, parola: geciciParola }, headers: { origin: 'https://saldirgan.example.com' }, maxRedirects: 0 });
    expect(r.status()).toBe(303);
    expect(r.headers()['location']).toBe('/giris?hata=kaynak');
    expect(r.headers()['set-cookie'] ?? '').not.toContain('ew_satis');
    const g = await request.get('/giris');
    expect(g.headers()['content-security-policy'] ?? '').toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(g.headers()['x-frame-options']).toBe('DENY');
    expect(g.headers()['x-powered-by']).toBeUndefined();
  });

  test('oturumsuz BFF ucu 401, CSRF belirteçsiz değişiklik 403 döner', async ({ page, request }) => {
    const koken = new URL(process.env['TEST_SATIS_URL'] ?? 'http://localhost:8081').origin;
    expect((await request.post('/api/ofisler', { data: {}, headers: { origin: koken } })).status()).toBe(401);
    await satisciHazirla(page);
    const r = await page.request.post('/api/ofisler', { data: { officeName: 'X' }, headers: { origin: new URL(page.url()).origin } });
    expect(r.status()).toBe(403);
    expect(await r.json()).toEqual({ mesaj: 'Güvenlik belirteci geçersiz; sayfayı yenileyin.' });
  });
});

test.describe('ofisler', () => {
  test('@F:satis.ofis.create @F:satis.ofis.view yeni ofis deneme lisansıyla açılır, geçici parola bir kez görünür, listede ve süzgeçte; müşavir portala girer', async ({ page, browser }) => {
    const hatalar = hataTopla(page);
    await satisciHazirla(page);
    await page.getByRole('link', { name: 'Yeni ofis aç' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Yeni ofis aç' })).toBeVisible();
    await ekranDenetle(page);
    // Alan hataları alanın altında
    await page.getByRole('button', { name: 'Ofisi aç' }).click();
    await expect(uyari(page)).toHaveText('Form bilgilerini kontrol edin.');
    await expect(page.getByLabel('E-posta')).toHaveAttribute('aria-invalid', 'true');
    await ekranDenetle(page);
    const ek = randomUUID().slice(0, 8);
    const ofis = `Yıldız Mali Müşavirlik ${ek}`;
    const eposta = `musavir-${ek}@eworks.test`;
    await page.getByLabel('Ofis adı').fill(ofis);
    await page.getByLabel('Müşavirin adı soyadı').fill('Ayşe Yıldız');
    await page.getByLabel('E-posta').fill(eposta);
    await page.getByLabel('Telefon').fill('0532 123 45 67');
    await page.getByLabel('Paket').selectOption('pro');
    await page.getByRole('button', { name: 'Ofisi aç' }).click();
    await expect(page.getByRole('status')).toHaveText('Ofis açıldı.');
    const gecici = (await page.getByLabel('Geçici parola').textContent())?.trim() ?? '';
    expect(gecici).toMatch(/^[A-Za-z0-9]{14}$/);
    await ekranDenetle(page);
    await page.getByRole('link', { name: 'Ofis listesine dön' }).click();
    await page.getByRole('searchbox', { name: 'Ara' }).fill(ek);
    await page.getByRole('button', { name: 'Süz' }).click();
    const satir = page.getByRole('row', { name: new RegExp(ofis) });
    await expect(satir).toContainText('Deneme');
    await expect(satir).toContainText('+90 532 123 45 67');
    await expect(satir).toContainText('Pro');
    await ekranDenetle(page);
    await page.getByLabel('Durum').selectOption('donduruldu');
    await page.getByRole('button', { name: 'Süz' }).click();
    await expect(page.getByText('Aramaya uyan ofis yok.')).toBeVisible();
    // Aynı adla ikinci ofis açılmaz
    await page.goto('/yeni');
    await page.getByLabel('Ofis adı').fill(ofis.toLocaleUpperCase('tr-TR'));
    await page.getByLabel('Müşavirin adı soyadı').fill('Başka Kişi');
    await page.getByLabel('E-posta').fill(`baska-${ek}@eworks.test`);
    await page.getByLabel('Telefon').fill('0532 765 43 21');
    await page.getByLabel('Paket').selectOption('baslangic');
    await page.getByRole('button', { name: 'Ofisi aç' }).click();
    await expect(uyari(page)).toHaveText('Bu adla bir ofis zaten var.');
    expect(hatalar.filter((h) => !/409|Failed to load resource/.test(h))).toEqual([]);
    // Müşavir, satıştan verilen geçici parolayla müşavir portalına girer ve ofisini görür
    const portal = await browser.newPage({ baseURL: process.env['TEST_WEB_URL'] ?? 'http://localhost:8080' });
    await portal.goto('/giris');
    await portal.getByLabel('E-posta').fill(eposta);
    await portal.getByLabel('Parola').fill(gecici);
    await portal.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(portal.getByRole('button', { name: 'Çıkış' })).toBeVisible();
    await expect(portal.getByText(ofis)).toBeVisible();
    await portal.close();
  });

  test('satış oturumu müşavir portalında geçmez (ayrı kimlik ve çerez)', async ({ page, browser }) => {
    await satisciHazirla(page);
    const satisCerezi = (await page.context().cookies()).find((c) => c.name.endsWith('ew_satis_sid'));
    const portal = await browser.newContext({ baseURL: process.env['TEST_WEB_URL'] ?? 'http://localhost:8080' });
    const host = new URL(process.env['TEST_WEB_URL'] ?? 'http://localhost:8080').hostname;
    if (satisCerezi) await portal.addCookies([{ name: 'ew_sid', value: satisCerezi.value, domain: host, path: '/' }]);
    const p = await portal.newPage();
    await p.goto('/');
    await expect(p).toHaveURL(/\/giris$/);
    await portal.close();
  });
});
