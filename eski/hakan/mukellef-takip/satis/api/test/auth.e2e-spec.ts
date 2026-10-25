import { hashPassword, hashRecoveryCode } from '../src/core.js';
import { MAX_FAILED } from '../src/domain/login-lock.js';
import { base32Decode, hotp, stepAt } from '../../../apps/api/src/modules/identity/domain/totp.js';
import { bootApp, createMember, CSRF, signIn, totpNow, type TestApp } from './support/app.js';

let t: TestApp;
beforeAll(async () => {
  t = await bootApp();
});
afterAll(() => t.close());

describe('satış girişi', () => {
  it('ilk giriş: 2FA kurulumu zorunlu, sonra geçici şifre değiştirilmeden portal açılmaz', async () => {
    const email = 'ilk@satis.test';
    await t.db.salesUser.create({ data: { email, fullName: 'İlk Kullanıcı', passwordHash: await hashPassword('Gecici-Sifre-1') } });
    const agent = t.agent();

    const step = await agent.post('/api/satis/auth/login').set(CSRF).send({ email: 'ILK@satis.test', password: 'Gecici-Sifre-1' }).expect(200);
    expect(step.body.step).toBe('setup');
    // Kurulum anahtarı oturum değildir
    await agent.get('/api/satis/offices').expect(401);

    const setup = await agent.post('/api/satis/auth/2fa/setup').set(CSRF).send({ token: step.body.token }).expect(200);
    expect(setup.body.qr).toMatch(/^data:image\/png;base64,/);
    await agent.post('/api/satis/auth/2fa/enable').set(CSRF).send({ token: step.body.token, code: '000000' }).expect(400);
    const enabled = await agent.post('/api/satis/auth/2fa/enable').set(CSRF).send({ token: step.body.token, code: totpNow(setup.body.secret) }).expect(200);
    expect(enabled.body.recoveryCodes).toHaveLength(10);
    expect(enabled.body.mustChangePassword).toBe(true);
    expect(enabled.headers['set-cookie'][0]).toMatch(/satis_oturum=.*HttpOnly.*SameSite=Strict/i);

    const blocked = await agent.get('/api/satis/offices').expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await agent.get('/api/satis/auth/me').expect(200);

    await agent.post('/api/satis/auth/password').set(CSRF).send({ current: 'Gecici-Sifre-1', next: 'kisa' }).expect(400);
    await agent.post('/api/satis/auth/password').set(CSRF).send({ current: 'yanlis', next: 'Yeni-Sifre-2026' }).expect(400);
    await agent.post('/api/satis/auth/password').set(CSRF).send({ current: 'Gecici-Sifre-1', next: 'Yeni-Sifre-2026' }).expect(200);
    await agent.get('/api/satis/offices').expect(200);

    const row = await t.db.salesUser.findUniqueOrThrow({ where: { email } });
    expect(row.totpSecretEnc).toMatch(/^v1:/);
    expect(row.mustChangePassword).toBe(false);
  });

  it('2FA kurulu kullanıcı: kod ister, aynı kod ikinci kez geçmez, kurtarma kodu bir kez geçer', async () => {
    const m = await createMember(t, 'kodlu@satis.test');
    const agent = t.agent();
    const login = () => agent.post('/api/satis/auth/login').set(CSRF).send({ email: m.email, password: m.password }).expect(200);

    const s1 = await login();
    expect(s1.body.step).toBe('mfa');
    await agent.post('/api/satis/auth/login/2fa').set(CSRF).send({ token: s1.body.token, code: '123456' }).expect(401);
    const code = totpNow(m.secret);
    await agent.post('/api/satis/auth/login/2fa').set(CSRF).send({ token: s1.body.token, code }).expect(200);
    const s2 = await login();
    await agent.post('/api/satis/auth/login/2fa').set(CSRF).send({ token: s2.body.token, code }).expect(401);

    await t.db.salesUser.update({ where: { id: m.id }, data: { recoveryCodeHashes: [hashRecoveryCode('abcd-efgh')] } });
    const s3 = await login();
    await agent.post('/api/satis/auth/login/2fa').set(CSRF).send({ token: s3.body.token, recoveryCode: 'ABCD-EFGH' }).expect(200);
    const s4 = await login();
    await agent.post('/api/satis/auth/login/2fa').set(CSRF).send({ token: s4.body.token, recoveryCode: 'abcd-efgh' }).expect(401);
  });

  it('ara adım anahtarı oturum yerine, kod adımı kurulum yerine kullanılamaz', async () => {
    const m = await createMember(t, 'adim@satis.test');
    const s = await t.http().post('/api/satis/auth/login').set(CSRF).send({ email: m.email, password: m.password }).expect(200);
    await t.http().get('/api/satis/offices').set('Cookie', `satis_oturum=${s.body.token}`).expect(401);
    await t.http().post('/api/satis/auth/2fa/setup').set(CSRF).send({ token: s.body.token }).expect(401);
    await t.http().post('/api/satis/auth/login/2fa').set(CSRF).send({ token: 'bozuk', code: '123456' }).expect(401);
  });

  it('hatalı şifre ve olmayan kullanıcı aynı yanıtı alır; art arda hatada hesap kilitlenir', async () => {
    const m = await createMember(t, 'kilit@satis.test');
    const wrong = () => t.http().post('/api/satis/auth/login').set(CSRF).send({ email: m.email, password: 'yanlis-sifre-1' });
    const ghost = await t.http().post('/api/satis/auth/login').set(CSRF).send({ email: 'yok@satis.test', password: 'x' }).expect(401);
    const bad = await wrong().expect(401);
    expect(bad.body.message).toBe(ghost.body.message);
    for (let i = 1; i < MAX_FAILED; i++) await wrong().expect(401);
    const locked = await t.http().post('/api/satis/auth/login').set(CSRF).send({ email: m.email, password: m.password }).expect(401);
    expect(locked.body.message).toMatch(/kilitli/);
    expect(await t.db.salesAuditLog.count({ where: { action: 'sales.login.locked', target: m.id } })).toBe(1);
  });

  it('kapatılan kullanıcı giriş yapamaz, açık oturumu düşer', async () => {
    const m = await createMember(t, 'kapali@satis.test');
    const agent = await signIn(t, m);
    await agent.get('/api/satis/auth/me').expect(200);
    await t.db.salesUser.update({ where: { id: m.id }, data: { isActive: false } });
    await agent.get('/api/satis/auth/me').expect(401);
    await t.http().post('/api/satis/auth/login').set(CSRF).send({ email: m.email, password: m.password }).expect(401);
  });

  it('şifre değişince diğer cihazdaki oturum düşer; çıkış çerezi siler', async () => {
    const m = await createMember(t, 'iki-cihaz@satis.test');
    const a = await signIn(t, m);
    const b = await signIn(t, m);
    await a.post('/api/satis/auth/password').set(CSRF).send({ current: m.password, next: 'Baska-Sifre-2026' }).expect(200);
    await a.get('/api/satis/auth/me').expect(200);
    await b.get('/api/satis/auth/me').expect(401);
    const out = await a.post('/api/satis/auth/logout').set(CSRF).expect(200);
    expect(out.headers['set-cookie'][0]).toMatch(/satis_oturum=;/);
  });

  it('CSRF: özel başlıksız ya da başka kökenden veri değiştiren istek reddedilir', async () => {
    const m = await createMember(t, 'csrf@satis.test');
    const agent = await signIn(t, m);
    await agent.post('/api/satis/team').send({ email: 'x@satis.test', fullName: 'X Y' }).expect(403);
    await agent.post('/api/satis/team').set({ 'X-Satis': '1', Origin: 'https://kotu.example' }).send({ email: 'x@satis.test', fullName: 'X Y' }).expect(403);
    await agent.post('/api/satis/team').set(CSRF).send({ email: 'x@satis.test', fullName: 'X Y' }).expect(201);
  });

  it('sağlık ucu oturumsuz çalışır', async () => {
    await t.http().get('/api/satis/health').expect(200, { ok: true });
  });

  it('oturumsuz istek reddedilir', async () => {
    await t.http().get('/api/satis/offices').expect(401);
    await t.http().get('/api/satis/team').set('Cookie', 'satis_oturum=sahte').expect(401);
  });

  it('kod bir sonraki adımdan da kabul edilir (saat kayması)', async () => {
    const m = await createMember(t, 'kayma@satis.test');
    const s = await t.http().post('/api/satis/auth/login').set(CSRF).send({ email: m.email, password: m.password }).expect(200);
    const next = hotp(base32Decode(m.secret), stepAt(Date.now()) + 1);
    await t.http().post('/api/satis/auth/login/2fa').set(CSRF).send({ token: s.body.token, code: next }).expect(200);
  });
});
