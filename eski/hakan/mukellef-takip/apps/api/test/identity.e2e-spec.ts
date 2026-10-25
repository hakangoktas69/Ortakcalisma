import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { base32Decode, hotp, stepAt } from '../src/modules/identity/domain/totp.js';
import { type Session, type TestApp, bootApp, stack } from './support/app.js';

// identity context regresyonu: giriş, 2FA, oturumlar, şifre, eklenti anahtarları, kullanıcı yönetimi ve büro politikası.

let t: TestApp;
let admin: Session;
const code = (secret: string, offset = 0) => hotp(base32Decode(secret), stepAt(Date.now()) + offset);

beforeAll(async () => {
  t = await bootApp();
  admin = await t.login(stack().demo.email, stack().demo.password);
}, 120_000);
afterAll(() => t?.close());

/** Yönetici olarak yeni kullanıcı açar, geçici şifreyle girip kalıcı şifre belirler. */
async function newUser(role: 'ADMIN' | 'STAFF', tag: string) {
  const email = `${tag}-${Date.now()}@mukellef.test`;
  const created = await t.http().post('/api/users').set(admin.auth).send({ email, fullName: `Test ${tag}`, role }).expect(201);
  const first = await t.login(email, created.body.tempPassword);
  const password = `Yeni-Sifre-${tag}-2026`;
  const changed = await t.http().post('/api/auth/password').set(first.auth).send({ currentPassword: created.body.tempPassword, newPassword: password }).expect(201);
  return { id: created.body.id as string, email, password, session: { access: changed.body.accessToken, refresh: changed.body.refreshToken, auth: { Authorization: `Bearer ${changed.body.accessToken}` } } as Session };
}

describe('giriş', () => {
  it('doğru bilgilerle erişim + yenileme anahtarı döner', async () => {
    const res = await t.http().post('/api/auth/login').send({ email: stack().demo.email, password: stack().demo.password }).expect(201);
    expect(res.body).toMatchObject({ mustChangePassword: false });
    expect(res.body.accessToken).toMatch(/^ey/);
    expect(res.body.refreshToken).toMatch(/^rt_/);
  });

  it('hatalı şifre ve kayıtsız e-posta aynı yanıtı verir', async () => {
    const a = await t.http().post('/api/auth/login').send({ email: stack().demo.staffEmail, password: 'yanlis-sifre' }).expect(401);
    const b = await t.http().post('/api/auth/login').send({ email: 'yok@mukellef.test', password: 'yanlis-sifre' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
    await t.db.user.update({ where: { email: stack().demo.staffEmail }, data: { failedLogins: 0 } });
  });

  it('5 hatalı denemede hesap 15 dk kilitlenir, doğru şifre de reddedilir', async () => {
    const u = await newUser('STAFF', 'kilit');
    for (let i = 0; i < 5; i++) await t.http().post('/api/auth/login').send({ email: u.email, password: 'yanlis' }).expect(401);
    const res = await t.http().post('/api/auth/login').send({ email: u.email, password: u.password }).expect(401);
    expect(res.body.message).toMatch(/dakika sonra/);
  });

  it('geçersiz gövde doğrulamada reddedilir', async () => {
    await t.http().post('/api/auth/login').send({ email: 'gecersiz', password: 'x' }).expect(400);
    await t.http().post('/api/auth/login').send({ email: stack().demo.email, password: 'x', fazla: 1 }).expect(400);
  });

  it('oturumsuz istek 401', async () => {
    await t.http().get('/api/auth/me').expect(401);
    await t.http().get('/api/auth/me').set({ Authorization: 'Bearer bozuk' }).expect(401);
  });
});

describe('me ve şifre', () => {
  it('me büro ve 2FA durumunu döner, şifre özeti dönmez', async () => {
    const res = await t.http().get('/api/auth/me').set(admin.auth).expect(200);
    expect(res.body).toMatchObject({ email: stack().demo.email, role: 'ADMIN', twoFactorEnabled: false });
    expect(res.body.tenant.name).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2|\$2b\$/);
  });

  it('şifre kuralları ve mevcut şifre kontrolü', async () => {
    const u = await newUser('STAFF', 'sifre');
    await t.http().post('/api/auth/password').set(u.session.auth).send({ currentPassword: 'yanlis', newPassword: 'Gecerli-Sifre-99' }).expect(400);
    await t.http().post('/api/auth/password').set(u.session.auth).send({ currentPassword: u.password, newPassword: 'kisa1' }).expect(400);
    await t.http().post('/api/auth/password').set(u.session.auth).send({ currentPassword: u.password, newPassword: 'sadeceharfler' }).expect(400);
    await t.http().post('/api/auth/password').set(u.session.auth).send({ currentPassword: u.password, newPassword: u.password }).expect(400);
  });

  it('şifre değişince diğer oturumlar düşer, yeni oturum çalışır', async () => {
    const u = await newUser('STAFF', 'oturum');
    const other = await t.login(u.email, u.password);
    const res = await t.http().post('/api/auth/password').set(u.session.auth).send({ currentPassword: u.password, newPassword: 'Baska-Sifre-2027' }).expect(201);
    await t.http().get('/api/auth/me').set(other.auth).expect(401);
    await t.http().post('/api/auth/refresh').send({ refreshToken: other.refresh }).expect(401);
    await t.http().get('/api/auth/me').set({ Authorization: `Bearer ${res.body.accessToken}` }).expect(200);
  });

  it('geçici şifreyle girişte yalnız şifre değiştirme açıktır', async () => {
    const email = `gecici-${Date.now()}@mukellef.test`;
    const created = await t.http().post('/api/users').set(admin.auth).send({ email, fullName: 'Geçici', role: 'STAFF' }).expect(201);
    const s = await t.login(email, created.body.tempPassword);
    const blocked = await t.http().get('/api/companies').set(s.auth).expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await t.http().get('/api/auth/me').set(s.auth).expect(200);
  });
});

describe('iki adımlı doğrulama', () => {
  it('kurulum → etkinleştirme → 2FA ile giriş → kurtarma kodu → kapatma', async () => {
    const u = await newUser('STAFF', 'totp');
    const setup = await t.http().post('/api/auth/2fa/setup').set(u.session.auth).expect(201);
    expect(setup.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(setup.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const stored = await t.db.user.findUniqueOrThrow({ where: { id: u.id }, select: { totpSecretEnc: true } });
    expect(stored.totpSecretEnc).toMatch(/^v[12]:/); // gizli anahtar şifreli

    await t.http().post('/api/auth/2fa/enable').set(u.session.auth).send({ code: '000000' }).expect(400);
    const enabled = await t.http().post('/api/auth/2fa/enable').set(u.session.auth).send({ code: code(setup.body.secret) }).expect(201);
    expect(enabled.body.recoveryCodes).toHaveLength(10);
    const session = { Authorization: `Bearer ${enabled.body.accessToken}` };

    const step1 = await t.http().post('/api/auth/login').send({ email: u.email, password: u.password }).expect(201);
    expect(step1.body).toMatchObject({ mfaRequired: true });
    expect(step1.body.accessToken).toBeUndefined();
    await t.http().post('/api/auth/login/2fa').send({ mfaToken: step1.body.mfaToken, code: '123456' }).expect(401);
    const ok = await t.http().post('/api/auth/login/2fa').send({ mfaToken: step1.body.mfaToken, code: code(setup.body.secret, 1) }).expect(201);
    expect(ok.body.accessToken).toBeTruthy();
    // Ara anahtar oturum değildir
    await t.http().get('/api/auth/me').set({ Authorization: `Bearer ${step1.body.mfaToken}` }).expect(401);

    const step2 = await t.http().post('/api/auth/login').send({ email: u.email, password: u.password }).expect(201);
    await t.http().post('/api/auth/login/2fa').send({ mfaToken: step2.body.mfaToken, recoveryCode: enabled.body.recoveryCodes[0] }).expect(201);
    const step3 = await t.http().post('/api/auth/login').send({ email: u.email, password: u.password }).expect(201);
    await t.http().post('/api/auth/login/2fa').send({ mfaToken: step3.body.mfaToken, recoveryCode: enabled.body.recoveryCodes[0] }).expect(401); // tek kullanımlık

    const me = await t.http().get('/api/auth/me').set({ Authorization: `Bearer ${ok.body.accessToken}` }).expect(200);
    expect(me.body).toMatchObject({ twoFactorEnabled: true, recoveryCodesLeft: 9 });

    const okAuth = { Authorization: `Bearer ${ok.body.accessToken}` };
    await t.http().post('/api/auth/2fa/disable').set(okAuth).send({ password: 'yanlis', code: code(setup.body.secret) }).expect(400);
    // Aynı kod ikinci kez kullanılamaz (son kullanılan adım +1)
    await t.http().post('/api/auth/2fa/disable').set(okAuth).send({ password: u.password, code: code(setup.body.secret, 1) }).expect(400);
    // Bir sonraki 30 sn'yi beklememek için son adımı geri al (yalnız test)
    await t.db.user.update({ where: { id: u.id }, data: { totpLastStep: null } });
    const off = await t.http().post('/api/auth/2fa/disable').set(okAuth).send({ password: u.password, code: code(setup.body.secret) }).expect(201);
    await t.http().get('/api/auth/me').set({ Authorization: `Bearer ${off.body.accessToken}` }).expect(200);
    await t.http().get('/api/auth/me').set(session).expect(401); // sessionVersion arttı
  });

  it('büro politikası: yönetici kendi 2FA\'sı olmadan zorunlu yapamaz', async () => {
    const res = await t.http().get('/api/users/policy').set(admin.auth).expect(200);
    expect(res.body).toMatchObject({ require2fa: false });
    expect(typeof res.body.usersWithout2fa).toBe('number');
    await t.http().put('/api/users/policy').set(admin.auth).send({ require2fa: true }).expect(400);
  });

  it('zorunluluk açıkken 2FA kurmamış kullanıcı yalnız kurulum uçlarına erişir', async () => {
    const boss = await newUser('ADMIN', 'politika');
    const setup = await t.http().post('/api/auth/2fa/setup').set(boss.session.auth).expect(201);
    const en = await t.http().post('/api/auth/2fa/enable').set(boss.session.auth).send({ code: code(setup.body.secret) }).expect(201);
    const bossAuth = { Authorization: `Bearer ${en.body.accessToken}` };
    await t.http().put('/api/users/policy').set(bossAuth).send({ require2fa: true }).expect(200);
    try {
      const blocked = await t.http().get('/api/companies').set(admin.auth).expect(403);
      expect(blocked.body.code).toBe('TWO_FACTOR_REQUIRED');
      await t.http().post('/api/auth/2fa/setup').set(admin.auth).expect(201);
    } finally {
      await t.http().put('/api/users/policy').set(bossAuth).send({ require2fa: false }).expect(200);
      await t.db.user.update({ where: { email: stack().demo.email }, data: { totpSecretEnc: null } });
    }
  });
});

describe('oturumlar', () => {
  it('liste, yenileme, uzaktan kapatma, çıkış', async () => {
    const u = await newUser('STAFF', 'cihaz');
    const phone = await t.login(u.email, u.password);
    const list = await t.http().get('/api/auth/sessions').set(u.session.auth).expect(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);
    expect(list.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    const rotated = await t.http().post('/api/auth/refresh').send({ refreshToken: phone.refresh }).expect(200);
    const phoneFamily = list.body.find((s: { current: boolean }) => !s.current).id;
    await t.http().delete(`/api/auth/sessions/${phoneFamily}`).set(u.session.auth).expect(204);
    await t.http().get('/api/auth/me').set({ Authorization: `Bearer ${rotated.body.accessToken}` }).expect(401);
    await t.http().delete('/api/auth/sessions/olmayan').set(u.session.auth).expect(404);

    await t.http().post('/api/auth/logout').set(u.session.auth).expect(204);
    await t.http().get('/api/auth/me').set(u.session.auth).expect(401);
  });

  it('başka kullanıcının oturumu kapatılamaz', async () => {
    const a = await newUser('STAFF', 'oturumA');
    const b = await newUser('STAFF', 'oturumB');
    const bSessions = await t.http().get('/api/auth/sessions').set(b.session.auth).expect(200);
    await t.http().delete(`/api/auth/sessions/${bSessions.body[0].id}`).set(a.session.auth).expect(404);
    await t.http().get('/api/auth/me').set(b.session.auth).expect(200);
  });

  it('geçersiz yenileme anahtarı 401', async () => {
    await t.http().post('/api/auth/refresh').send({ refreshToken: 'rt_yok' }).expect(401);
  });
});

describe('eklenti anahtarları', () => {
  it('oluştur (bir kez gösterilir) → listele → aktarım ucunda kullan → iptal', async () => {
    const created = await t.http().post('/api/tokens').set(admin.auth).send({ name: 'Ofis bilgisayarı' }).expect(201);
    expect(created.body.token).toMatch(/^mt_/);
    expect(created.body.expiresAt).toBeTruthy();
    const list = await t.http().get('/api/tokens').set(admin.auth).expect(200);
    const row = list.body.find((x: { id: string }) => x.id === created.body.id);
    expect(row).toBeTruthy();
    expect(row.token).toBeUndefined();

    const tokenAuth = { Authorization: `Bearer ${created.body.token}` };
    await t.http().post('/api/import/page').set(tokenAuth).send({ pageUrl: 'https://ebeyanname.gib.gov.tr/x', tables: [] }).expect(201);
    // Eklenti anahtarı başka uçta geçmez
    await t.http().get('/api/companies').set(tokenAuth).expect(401);

    await t.http().delete(`/api/tokens/${created.body.id}`).set(admin.auth).expect(200);
    await t.http().post('/api/import/page').set(tokenAuth).send({ pageUrl: 'https://ebeyanname.gib.gov.tr/x', tables: [] }).expect(401);
    await t.http().delete(`/api/tokens/${created.body.id}`).set(admin.auth).expect(404);
  });

  it('süresi dolan anahtar çalışmaz', async () => {
    const created = await t.http().post('/api/tokens').set(admin.auth).send({ name: 'Eski' }).expect(201);
    await t.db.apiToken.update({ where: { id: created.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await t.http().post('/api/import/page').set({ Authorization: `Bearer ${created.body.token}` }).send({ pageUrl: 'https://ebeyanname.gib.gov.tr/x', tables: [] }).expect(401);
  });
});

describe('kullanıcı yönetimi (yönetici)', () => {
  it('liste, oluşturma, aynı e-posta reddi, güncelleme, devre dışı bırakma', async () => {
    const list = await t.http().get('/api/users').set(admin.auth).expect(200);
    expect(list.body.some((u: { isMe: boolean }) => u.isMe)).toBe(true);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash/);

    const u = await newUser('STAFF', 'yonetim');
    await t.http().post('/api/users').set(admin.auth).send({ email: u.email, fullName: 'Tekrar', role: 'STAFF' }).expect(400);
    await t.http().patch(`/api/users/${u.id}`).set(admin.auth).send({ fullName: 'Yeni Ad' }).expect(200);
    await t.http().patch(`/api/users/${u.id}`).set(admin.auth).send({ isActive: false }).expect(200);
    await t.http().get('/api/auth/me').set(u.session.auth).expect(401);
    await t.http().post('/api/auth/login').send({ email: u.email, password: u.password }).expect(401);
    await t.http().patch(`/api/users/${u.id}`).set(admin.auth).send({ isActive: true }).expect(200);
    await t.login(u.email, u.password);
  });

  it('şifre ve 2FA sıfırlama oturumları kapatır', async () => {
    const u = await newUser('STAFF', 'sifirla');
    const reset = await t.http().post(`/api/users/${u.id}/reset-password`).set(admin.auth).expect(201);
    expect(reset.body.tempPassword).toHaveLength(12);
    await t.http().get('/api/auth/me').set(u.session.auth).expect(401);
    const s = await t.login(u.email, reset.body.tempPassword);
    await t.http().post(`/api/users/${u.id}/reset-2fa`).set(admin.auth).expect(201);
    await t.http().get('/api/auth/me').set(s.auth).expect(401);
  });

  it('son aktif yönetici yetkisini kaybedemez; kendini devre dışı bırakamaz', async () => {
    const tenantId = stack().demo.id;
    const others = await t.db.user.findMany({ where: { tenantId, role: 'ADMIN', isActive: true, email: { not: stack().demo.email } }, select: { id: true } });
    await t.db.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: false } });
    try {
      const me = await t.http().get('/api/auth/me').set(admin.auth).expect(200);
      await t.http().patch(`/api/users/${me.body.id}`).set(admin.auth).send({ role: 'STAFF' }).expect(400);
      await t.http().patch(`/api/users/${me.body.id}`).set(admin.auth).send({ isActive: false }).expect(400);
    } finally {
      await t.db.user.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { isActive: true } });
    }
  });

  it('personel yönetici uçlarına erişemez', async () => {
    const staff = await t.login(stack().demo.staffEmail, stack().demo.staffPassword);
    await t.http().get('/api/users').set(staff.auth).expect(403);
    await t.http().put('/api/users/policy').set(staff.auth).send({ require2fa: false }).expect(403);
    await t.http().post('/api/users').set(staff.auth).send({ email: 'x@x.test', fullName: 'X Y', role: 'ADMIN' }).expect(403);
  });

  it('başka büronun kullanıcısı yönetilemez', async () => {
    const b = await t.db.user.findUniqueOrThrow({ where: { email: stack().B.email }, select: { id: true } });
    await t.http().patch(`/api/users/${b.id}`).set(admin.auth).send({ fullName: 'Ele geçirildi' }).expect(404);
    await t.http().post(`/api/users/${b.id}/reset-password`).set(admin.auth).expect(404);
  });
});
