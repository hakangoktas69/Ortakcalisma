import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RESET_MAX_ATTEMPTS } from '../src/modules/identity/domain/password-reset.js';
import { type Session, type TestApp, bootApp, stack } from './support/app.js';

// "Şifremi unuttum" regresyonu: kod isteme (e-posta / telefon), doğrulama, deneme sınırı, süre, oturumların düşmesi, 2FA'nın korunması.

let t: TestApp;
let admin: Session;

beforeAll(async () => {
  t = await bootApp();
  admin = await t.login(stack().demo.email, stack().demo.password);
}, 120_000);
afterAll(() => t?.close());

const request = (identifier: string) => t.http().post('/api/auth/password-reset/request').send({ identifier });
const confirm = (identifier: string, code: string, newPassword: string) =>
  t.http().post('/api/auth/password-reset/confirm').send({ identifier, code, newPassword });

/** Yönetici olarak yeni kullanıcı açar ve kalıcı şifre belirletir. */
async function newUser(tag: string, phone?: string) {
  const email = `${tag}-${Date.now()}@mukellef.test`;
  const created = await t.http().post('/api/users').set(admin.auth).send({ email, fullName: `Test ${tag}`, role: 'STAFF' }).expect(201);
  const first = await t.login(email, created.body.tempPassword);
  const password = `Ilk-Sifre-${tag}-2026`;
  await t.http().post('/api/auth/password').set(first.auth).send({ currentPassword: created.body.tempPassword, newPassword: password }).expect(201);
  if (phone) await t.db.user.update({ where: { id: created.body.id }, data: { phone } });
  return { id: created.body.id as string, email, password };
}

describe('şifremi unuttum', () => {
  it('kayıtlı ve kayıtsız e-postaya aynı yanıt (geliştirmede kod yalnız kayıtlıda görünür)', async () => {
    const u = await newUser('yanit');
    const known = await request(u.email.toUpperCase()).expect(200);
    const unknown = await request('kimse@yok.test').expect(200);
    const { devCode, ...rest } = known.body;
    expect(devCode).toMatch(/^\d{6}$/);
    expect(rest).toEqual({ ...unknown.body, to: rest.to });
    expect(unknown.body).toMatchObject({ sent: true, channel: 'email', ttlMinutes: 10 });
    expect(unknown.body.devCode).toBeUndefined();
    // Kodun kendisi değil özeti saklanır
    const row = await t.db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.passwordResetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.passwordResetHash).not.toContain(devCode);
  });

  it('doğru kodla şifre değişir, açık oturumlar düşer, kod ikinci kez kullanılamaz', async () => {
    const u = await newUser('degisim');
    const before = await t.login(u.email, u.password);
    const { body } = await request(u.email).expect(200);
    await confirm(u.email, body.devCode, 'kisa').expect(400);
    await confirm(u.email, body.devCode, 'Yeni-Sifre-Unuttum-2026').expect(200);

    await t.http().get('/api/auth/me').set(before.auth).expect(401);
    await t.http().post('/api/auth/refresh').send({ refreshToken: before.refresh }).expect(401);
    await t.http().post('/api/auth/login').send({ email: u.email, password: u.password }).expect(401);
    await t.login(u.email, 'Yeni-Sifre-Unuttum-2026');
    await confirm(u.email, body.devCode, 'Baska-Sifre-2026x').expect(400);

    const actions = (await t.db.auditLog.findMany({ where: { userId: u.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['auth.password.reset.request', 'auth.password.reset']));
  });

  it(`${RESET_MAX_ATTEMPTS} yanlış denemeden sonra doğru kod da reddedilir`, async () => {
    const u = await newUser('deneme');
    const { body } = await request(u.email).expect(200);
    const wrong = body.devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < RESET_MAX_ATTEMPTS; i++) await confirm(u.email, wrong, 'Yeni-Sifre-Deneme-2026').expect(400);
    const res = await confirm(u.email, body.devCode, 'Yeni-Sifre-Deneme-2026').expect(400);
    expect(res.body.message).toMatch(/Yeni kod isteyin/);
  });

  it('süresi dolan kod reddedilir; 60 sn dolmadan yeni kod üretilmez', async () => {
    const u = await newUser('sure');
    const first = await request(u.email).expect(200);
    const again = await request(u.email).expect(200);
    expect(again.body.devCode).toBeUndefined();
    await t.db.user.update({ where: { id: u.id }, data: { passwordResetExpires: new Date(Date.now() - 1000) } });
    await confirm(u.email, first.body.devCode, 'Yeni-Sifre-Sure-2026').expect(400);
  });

  it('cep telefonuyla çalışır; aynı telefon iki hesapta kayıtlıysa kod gönderilmez', async () => {
    const u = await newUser('tel', '905551110001');
    const r = await request('0555 111 00 01').expect(200);
    expect(r.body).toMatchObject({ channel: 'phone', to: '+90 5** *** ** 01' });
    await confirm('+90 555 111 0001', r.body.devCode, 'Yeni-Sifre-Telefon-2026').expect(200);
    await t.login(u.email, 'Yeni-Sifre-Telefon-2026');

    await newUser('cift-a', '905551110002');
    await newUser('cift-b', '905551110002');
    const dup = await request('05551110002').expect(200);
    expect(dup.body.devCode).toBeUndefined();
  });

  it('iki adımlı doğrulama atlanmaz: yeni şifreyle girişte kod istenir', async () => {
    const u = await newUser('ikiadim');
    await t.db.user.update({ where: { id: u.id }, data: { totpEnabledAt: new Date() } });
    const { body } = await request(u.email).expect(200);
    await confirm(u.email, body.devCode, 'Yeni-Sifre-2fa-2026x').expect(200);
    const login = await t.http().post('/api/auth/login').send({ email: u.email, password: 'Yeni-Sifre-2fa-2026x' }).expect(201);
    expect(login.body).toMatchObject({ mfaRequired: true });
    expect(login.body.accessToken).toBeUndefined();
  });

  it('kapalı kullanıcıya kod gitmez; geçersiz girdi reddedilir', async () => {
    const u = await newUser('kapali');
    await t.db.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect((await request(u.email).expect(200)).body.devCode).toBeUndefined();
    await request('ne-eposta-ne-telefon').expect(400);
    await request('0212 555 66 77').expect(400);
    await confirm(u.email, '12345', 'Yeni-Sifre-2026x').expect(400);
  });
});

describe('şifremi unuttum kapalıyken', () => {
  it('uçlar 503 döner', async () => {
    const off = await bootApp({ PASSWORD_RESET_MODE: 'off' });
    try {
      await off.http().post('/api/auth/password-reset/request').send({ identifier: 'a@b.test' }).expect(503);
      await off.http().post('/api/auth/password-reset/confirm').send({ identifier: 'a@b.test', code: '123456', newPassword: 'Yeni-Sifre-2026x' }).expect(503);
    } finally {
      await off.close();
      // Sonraki dosyalar varsayılan (mock) ayarla açılır
      process.env.PASSWORD_RESET_MODE = 'mock';
    }
  });
});
