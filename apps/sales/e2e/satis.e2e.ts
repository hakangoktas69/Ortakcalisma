import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { ekranDenetle, epostaGir, hataTopla, parolaGir, satisciAc, satisciHazirla, uyari } from './yardim.ts';

// Satış portalı kabul testleri (D27, D40, D41): satışçı girişi (2FA isteğe bağlı; 2FA'sız girişte resimli güvenlik kodu),
// 2FA açma/kapatma, ofis listesi, yeni ofis (+ müşavirin portala girişi).

const MESAJ_GIRIS = 'E-posta ya da parola hatalı. Art arda 5 hatalı denemede hesap 15 dakika kilitlenir.';

test.describe('satış girişi', () => {
  test('@F:satis.oturum.login ilk giriş güvenlik koduyla; geçici parola değiştirilir; 2FA\'sız oturum açılır; çerez HttpOnly', async ({ page }) => {
    const hatalar = hataTopla(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/giris$/);
    await ekranDenetle(page);
    await satisciHazirla(page, { denetle: true });
    await expect(page.getByRole('heading', { level: 1, name: 'Ofisler' })).toBeVisible();
    await ekranDenetle(page);
    await page.goto('/sifre');
    await expect(page.getByRole('heading', { level: 2, name: 'İki adımlı doğrulama: kapalı' })).toBeVisible();
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

  test('@F:satis.oturum.mfa 2FA açılınca güvenlik kodu istenmez, kod adımı gelir; yanlış kod reddedilir; kurtarma kodu bir kez geçer', async ({ page, context }) => {
    const s = await satisciHazirla(page, { ikiAdim: true, denetle: true });
    expect(s.kurtarma).toHaveLength(10);
    await context.clearCookies();
    await epostaGir(page, s.eposta);
    await expect(page.getByLabel('Güvenlik kodu')).toHaveCount(0);
    await page.getByLabel('Parola').fill(s.parola);
    await page.getByRole('button', { name: 'Giriş yap' }).click();
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

  test('@F:satis.oturum.mfa 2FA kapatılır (parola + kurtarma kodu); sonraki girişte güvenlik kodu yeniden istenir', async ({ page, context }) => {
    const s = await satisciHazirla(page, { ikiAdim: true });
    await page.goto('/sifre');
    await expect(page.getByRole('heading', { level: 2, name: 'İki adımlı doğrulama: açık' })).toBeVisible();
    await ekranDenetle(page);
    await page.locator('#kapat-parola').fill(s.parola);
    await page.getByText('Telefonuma erişemiyorum').click();
    await page.getByLabel('Kurtarma kodu').fill(s.kurtarma[1] ?? '');
    await page.getByRole('button', { name: 'İki adımlı doğrulamayı kapat' }).click();
    await expect(page.getByRole('status')).toHaveText('İki adımlı doğrulama kapatıldı.');
    await expect(page.getByRole('heading', { level: 2, name: 'İki adımlı doğrulama: kapalı' })).toBeVisible();
    await context.clearCookies();
    await epostaGir(page, s.eposta);
    await expect(page.getByRole('img', { name: 'Güvenlik kodu resmi' })).toBeVisible();
  });

  test('@F:satis.oturum.login yanlış güvenlik kodunda parola denenmez; yanlış parola ve olmayan e-posta aynı mesajı alır; ara adım çerezi olmadan kod ekranı açılmaz', async ({ page }) => {
    const { eposta, geciciParola } = await satisciAc();
    await epostaGir(page, eposta);
    await page.getByLabel('Parola').fill(geciciParola);
    await page.getByLabel('Güvenlik kodu').fill('YANLS');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(uyari(page)).toHaveText('Güvenlik kodu hatalı; resimdeki yeni kodu yazın.');
    // Aynı e-postayla devam: yeni kod gösterilir, e-posta yeniden sorulmaz
    await expect(page.getByText(eposta)).toBeVisible();
    await ekranDenetle(page);
    for (const e of [eposta, 'olmayan-satisci@eworks.test']) {
      await parolaGir(page, e, 'yanlis-parola-12345');
      await expect(uyari(page)).toHaveText(MESAJ_GIRIS);
    }
    await page.goto('/giris/dogrula');
    await expect(page).toHaveURL(/\/giris$/);
    await page.goto('/guvenlik/2fa');
    await expect(page).toHaveURL(/\/giris$/);
  });

  test('başka kökenden gelen giriş isteği reddedilir; güvenlik başlıkları var', async ({ request }) => {
    const r = await request.post('/api/oturum/baslat', { form: { eposta: 'a@b.test' }, headers: { origin: 'https://saldirgan.example.com' }, maxRedirects: 0 });
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
    expect((await request.post('/api/guvenlik/2fa/kapat', { data: {}, headers: { origin: koken } })).status()).toBe(401);
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
