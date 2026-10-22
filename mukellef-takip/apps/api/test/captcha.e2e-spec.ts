import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestApp, bootApp, stack } from './support/app.js';

// Girişte resimli güvenlik kodu (bu dosyada AÇIK): 2FA'sı kapalı hesaplarda şifreden önce istenir.

let t: TestApp;
let redis: Redis;

beforeAll(async () => {
  t = await bootApp({ CAPTCHA_MODE: 'on' });
  redis = new Redis(stack().redisUrl);
}, 120_000);
afterAll(async () => {
  await redis?.quit();
  await t?.close();
  // Sonraki dosyalar varsayılan (kapalı) ayarla açılır
  process.env.CAPTCHA_MODE = 'off';
});

const login = (body: Record<string, unknown>) => t.http().post('/api/auth/login').send(body);
/** Yeni kod alır; testte cevabı Redis'ten okur (kullanıcı resimden okur) */
async function captcha() {
  const r = await t.http().get('/api/auth/captcha').expect(200);
  return { id: r.body.id as string, svg: r.body.svg as string, answer: (await redis.get(`captcha:${r.body.id}`))! };
}

describe('girişte güvenlik kodu', () => {
  const demo = () => ({ email: stack().demo.email, password: stack().demo.password });

  it('kod olmadan şifreye bakılmaz; kayıtsız e-posta da aynı yanıtı alır', async () => {
    const before = await t.db.user.findUniqueOrThrow({ where: { email: stack().demo.email }, select: { failedLogins: true } });
    const a = await login({ ...demo(), password: 'yanlis-sifre' }).expect(400);
    const b = await login({ email: 'kimse@yok.test', password: 'x' }).expect(400);
    expect(a.body).toMatchObject({ code: 'CAPTCHA_REQUIRED' });
    expect(b.body).toEqual(a.body);
    // Şifre denenmediği için hatalı giriş sayılmadı
    const after = await t.db.user.findUniqueOrThrow({ where: { email: stack().demo.email }, select: { failedLogins: true } });
    expect(after.failedLogins).toBe(before.failedLogins);
  });

  it('resim yazı değil çizimdir; kod 5 karakter ve 5 dakika saklanır', async () => {
    const c = await captcha();
    expect(c.svg).toMatch(/^<svg/);
    expect(c.svg).toContain('<path');
    expect(c.svg).not.toContain('<text');
    expect(c.svg).not.toContain(c.answer);
    expect(c.answer).toMatch(/^[A-Z2-9]{5}$/);
    expect(await redis.ttl(`captcha:${c.id}`)).toBeGreaterThan(250);
  });

  it('yanlış kod reddedilir ve kod bir daha kullanılamaz', async () => {
    const c = await captcha();
    const wrong = await login({ ...demo(), captchaId: c.id, captchaAnswer: 'XXXXX' }).expect(400);
    expect(wrong.body.code).toBe('CAPTCHA_INVALID');
    await login({ ...demo(), captchaId: c.id, captchaAnswer: c.answer }).expect(400);
  });

  it('doğru kodla (küçük harf de olur) giriş yapılır; kod tek kullanımlıktır', async () => {
    const c = await captcha();
    const ok = await login({ ...demo(), captchaId: c.id, captchaAnswer: ` ${c.answer.toLowerCase()} ` }).expect(201);
    expect(ok.body.accessToken).toMatch(/^ey/);
    const again = await login({ ...demo(), captchaId: c.id, captchaAnswer: c.answer }).expect(400);
    expect(again.body.code).toBe('CAPTCHA_INVALID');
  });

  it('doğru kod + yanlış şifre: hatalı giriş olarak sayılır', async () => {
    const c = await captcha();
    await login({ email: stack().demo.staffEmail, password: 'yanlis-sifre', captchaId: c.id, captchaAnswer: c.answer }).expect(401);
    const u = await t.db.user.findUniqueOrThrow({ where: { email: stack().demo.staffEmail }, select: { failedLogins: true } });
    expect(u.failedLogins).toBeGreaterThan(0);
    await t.db.user.update({ where: { email: stack().demo.staffEmail }, data: { failedLogins: 0 } });
  });

  it('iki adımlı doğrulaması açık hesaba güvenlik kodu sorulmaz', async () => {
    const b = stack().B;
    await t.db.user.update({ where: { email: b.email }, data: { totpEnabledAt: new Date(), totpSecretEnc: 'v1:x:y:z' } });
    try {
      const r = await login({ email: b.email, password: b.password }).expect(201);
      expect(r.body).toMatchObject({ mfaRequired: true });
    } finally {
      await t.db.user.update({ where: { email: b.email }, data: { totpEnabledAt: null, totpSecretEnc: null } });
    }
  });

  it('geçersiz kod kimliği doğrulamada reddedilir', async () => {
    await login({ ...demo(), captchaId: 'kimlik-degil', captchaAnswer: 'ABCDE' }).expect(400);
  });
});
