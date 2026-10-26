// Gerçek yığın: satış rolleri (eworks_sales, kontrol + shard), GoTrue, Redis. Satış girişi (2FA isteğe bağlı, 2FA'sızda
// resimli güvenlik kodu; D41), satıştan ofis açma ve müşavirin portala girişi, satış rolünün veri sınırı, yarışlar.
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { GoTrueAuthProvider, login, PgMembershipReader, RedisSessionStore } from '@eworks/identity-access';
import { createPool, ShardRouter } from '@eworks/platform';
import { yigin } from '@eworks/testing';
import {
  beginLogin,
  beginTotpEnrollment,
  changeOwnPassword,
  confirmTotpEnrollment,
  createSalesUser,
  currentSalesSession,
  disableTotp,
  listOffices,
  loginCaptcha,
  NodeSalesCrypto,
  openOfficeForSale,
  PgDirectory,
  PgSalesAccounts,
  PgSalesAudit,
  PgSalesUsers,
  PgTenantProvisioner,
  RedisLocks,
  RedisSalesSessionStore,
  salesLogin,
  SvgCaptchaGenerator,
  totpCodeAt,
  verifySecondFactor,
} from '@eworks/sales';

const satis = ShardRouter.fromUrls(yigin.controlUrl('eworks_sales'), yigin.shardUrls('eworks_sales'));
const web = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_app'));
const yonetici = createPool(yigin.controlAdminUrl(), 1);
const redis = new Redis(yigin.redisUrl());
const auth = new GoTrueAuthProvider(yigin.authUrl(), yigin.jwtSecret());
const crypto = new NodeSalesCrypto('entegrasyon-testi-muhur-anahtari-32+');
const clock = { now: () => new Date() };
const authDeps = {
  users: new PgSalesUsers(satis.control),
  sessions: new RedisSalesSessionStore(redis),
  crypto,
  captcha: new SvgCaptchaGenerator(),
  audit: new PgSalesAudit(satis.control),
  clock,
  newId: randomUUID,
  csrf: () => randomUUID(),
};
const officeDeps = {
  identity: auth,
  directory: new PgDirectory(satis),
  tenant: new PgTenantProvisioner(satis),
  accounts: new PgSalesAccounts(satis.control),
  audit: new PgSalesAudit(satis.control),
  locks: new RedisLocks(redis),
  crypto,
  clock,
  newId: randomUUID,
};

afterAll(async () => {
  await Promise.all([satis.end(), web.end(), yonetici.end(), redis.quit()]);
});

const adim = () => Math.floor(Date.now() / 30_000);
const kod = totpCodeAt;
/** Güvenlik kodunun yanıtı (test Redis'ten okur; kullanıcı resimden okur). */
const kodYaniti = async (startId: string) => (await redis.get(`ew:satis:oturum:${startId}:kod`)) ?? '';

/** E-posta adımı + gerekiyorsa güvenlik kodu (doğru yanıtla) + parola. */
async function girisYap(email: string, password: string) {
  const b = await beginLogin(email, authDeps);
  if (!b.ok) throw new Error(b.error);
  if (!b.value.captcha) return salesLogin({ startId: b.value.startId, password }, authDeps);
  await loginCaptcha(b.value.startId, authDeps);
  return salesLogin({ startId: b.value.startId, password, captcha: await kodYaniti(b.value.startId) }, authDeps);
}

/** Gerçek akışla satışçı: aç → güvenlik koduyla ilk giriş → parola değiştir → 2FA aç. */
async function satisci(ikiAdim = true) {
  const email = `satis-${randomUUID().slice(0, 8)}@eworks.test`;
  const c = await createSalesUser({ email, fullName: 'Selin Satış' }, authDeps);
  if (!c.ok) throw new Error(c.error);
  const g = await girisYap(email, c.value.tempPassword);
  if (!g.ok || g.value.stage !== 'oturum') throw new Error('ilk giriş');
  const sessionId = g.value.sessionId;
  const p0 = await currentSalesSession(sessionId, authDeps);
  if (!p0) throw new Error('oturum yok');
  const password = `Satis-${randomUUID().slice(0, 8)}-2026`;
  const r = await changeOwnPassword(sessionId, p0, { current: c.value.tempPassword, next: password }, authDeps);
  if (!r.ok) throw new Error(r.error);
  let secret = '';
  let step = 0;
  let kurtarma: string[] = [];
  if (ikiAdim) {
    const p1 = await currentSalesSession(sessionId, authDeps);
    if (!p1) throw new Error('oturum yok');
    const b = await beginTotpEnrollment(p1, authDeps);
    if (!b.ok) throw new Error(b.error);
    secret = b.value.secret;
    step = adim();
    const e = await confirmTotpEnrollment(sessionId, p1, { password, code: kod(secret, step) }, authDeps);
    if (!e.ok) throw new Error(e.error);
    kurtarma = e.value.recoveryCodes;
  }
  const p = await currentSalesSession(sessionId, authDeps);
  if (!p) throw new Error('oturum yok');
  return { ...p, password, secret, step, sessionId, kurtarma };
}

/** 2FA'lı satışçının ara adımı. */
async function adimAl(email: string, password: string) {
  const g = await girisYap(email, password);
  if (!g.ok || g.value.stage !== 'mfa') throw new Error('ara adım bekleniyordu');
  return g.value.stepId;
}

describe('satış girişi (gerçek scrypt + TOTP + güvenlik kodu + Redis)', () => {
  it('[F:satis.oturum.login] [F:satis.oturum.mfa] 2FA açılınca girişte güvenlik kodu istenmez, kod adımı gelir; gizli anahtar mühürlü', async () => {
    const s = await satisci();
    const { rows } = await yonetici.query<{ totp_secret_enc: string; password_hash: string }>('select totp_secret_enc, password_hash from sales.users where id = $1', [s.userId]);
    expect(rows[0]?.totp_secret_enc).not.toContain(s.secret);
    expect(rows[0]?.password_hash).toMatch(/^scrypt\$/);
    expect(await beginLogin(s.email, authDeps)).toMatchObject({ ok: true, value: { captcha: false } });
    const stepId = await adimAl(s.email, s.password);
    expect(await redis.ttl(`ew:satis:oturum:${stepId}`)).toBeLessThanOrEqual(300);
    // Kurulumda kullanılan adım (ve öncesi) tekrar kullanılamaz; bir sonraki adımın kodu geçer
    expect(await verifySecondFactor(stepId, { code: kod(s.secret, s.step) }, authDeps)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(await verifySecondFactor(stepId, { code: kod(s.secret, s.step + 1) }, authDeps)).toMatchObject({ ok: true });
    const { rows: denetim } = await yonetici.query<{ action: string }>('select action from sales.audit_entries where subject = $1 order by id', [s.userId]);
    expect(denetim.map((r) => r.action)).toEqual(['satis.kullanici.acildi', 'satis.oturum.giris', 'satis.oturum.parola_degisti', 'satis.oturum.2fa_acildi', 'satis.oturum.giris']);
  });

  it('[F:satis.oturum.login] 2FA\'sız hesap güvenlik kodu ister: yanlış kodda parola denenmez (sayaç işlemez), kod tek kullanımlıktır', async () => {
    const s = await satisci(false);
    const b = await beginLogin(s.email, authDeps);
    if (!b.ok || !b.value.captcha) throw new Error('kod bekleniyordu');
    const svg = await loginCaptcha(b.value.startId, authDeps);
    expect(svg).toMatch(/^<svg/);
    const dogru = await kodYaniti(b.value.startId);
    expect(svg).not.toContain(dogru);
    expect(await salesLogin({ startId: b.value.startId, password: 'yanlis-parola-1', captcha: 'YANLS' }, authDeps)).toEqual({ ok: false, error: 'kod_hatali' });
    const { rows } = await yonetici.query<{ failed_logins: number }>('select failed_logins from sales.users where id = $1', [s.userId]);
    expect(rows[0]?.failed_logins).toBe(0);
    // Yanlış deneme kodu tüketti: doğru yanıt da artık geçmez
    expect(await salesLogin({ startId: b.value.startId, password: s.password, captcha: dogru }, authDeps)).toEqual({ ok: false, error: 'kod_hatali' });
    await loginCaptcha(b.value.startId, authDeps);
    expect(await salesLogin({ startId: b.value.startId, password: s.password, captcha: (await kodYaniti(b.value.startId)).toLowerCase() }, authDeps)).toMatchObject({ ok: true, value: { stage: 'oturum' } });
  });

  it('[F:satis.oturum.mfa] 2FA kapatılınca diğer oturumlar düşer, sonraki girişte güvenlik kodu istenir', async () => {
    const s = await satisci();
    const diger = await verifySecondFactor(await adimAl(s.email, s.password), { code: kod(s.secret, s.step + 1) }, authDeps);
    if (!diger.ok) throw new Error(diger.error);
    expect(await disableTotp(s.sessionId, s, { password: s.password, recoveryCode: s.kurtarma[0] ?? '' }, authDeps)).toMatchObject({ ok: true });
    const { rows } = await yonetici.query<{ totp_enabled_at: Date | null; totp_secret_enc: string | null; n: number }>(
      'select totp_enabled_at, totp_secret_enc, cardinality(recovery_code_hashes)::int as n from sales.users where id = $1', [s.userId]);
    expect(rows[0]).toEqual({ totp_enabled_at: null, totp_secret_enc: null, n: 0 });
    expect(await currentSalesSession(s.sessionId, authDeps)).toMatchObject({ twoFactor: false });
    expect(await currentSalesSession(diger.value.sessionId, authDeps)).toBeNull();
    expect(await beginLogin(s.email, authDeps)).toMatchObject({ ok: true, value: { captcha: true } });
  });
});

describe('satıştan ofis açma (gerçek yığın)', () => {
  it('[F:satis.ofis.create] [F:satis.ofis.view] ofis deneme lisansıyla açılır, listede görünür; müşavir geçici parolayla portala girer', async () => {
    const s = await satisci();
    const ad = `Satış Ofisi ${randomUUID().slice(0, 8)}`;
    const eposta = `musavir-${randomUUID().slice(0, 8)}@eworks.test`;
    const r = await openOfficeForSale(s, { officeName: ad, contactName: 'Ayşe Yıldız', email: eposta, phone: '0532 123 45 67', plan: 'pro', trialDays: '14' }, officeDeps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const liste = await listOffices({ q: ad }, officeDeps);
    expect(liste).toEqual([expect.objectContaining({ orgId: r.value.orgId, officeName: ad, status: 'deneme', planName: 'Pro', contactPhone: '+90 532 123 45 67' })]);
    const portal = await login(
      { email: eposta, password: r.value.tempPassword },
      { auth, members: new PgMembershipReader(web), sessions: new RedisSessionStore(redis, 60), ids: { csrf: () => randomUUID() } },
    );
    expect(portal.ok).toBe(true);
    // İki denetim kaydı: satışın kendi zinciri ve ofisin shard'daki zinciri (kaynak + satış kullanıcısı)
    const { rows: sd } = await yonetici.query<{ action: string; details: Record<string, unknown> }>('select action, details from sales.audit_entries where subject = $1', [r.value.orgId]);
    expect(sd).toEqual([{ action: 'satis.ofis.acildi', details: { paket: 'pro', deneme_gun: 14 } }]);
    const shard = createPool(yigin.shardAdminUrls().get(await web.shardOf(r.value.orgId)) ?? '', 1);
    try {
      const { rows: od } = await shard.query<{ action: string; actor_kind: string; details: Record<string, string> }>(
        'select action, actor_kind, details from audit.entries where org_id = $1 order by id', [r.value.orgId]);
      expect(od.map((x) => x.action)).toEqual(['hesap.ofis_acildi', 'hesap.uye_eklendi']);
      expect(od[1]).toMatchObject({ actor_kind: 'system', details: { kaynak: 'satis_portali', satis_kullanici: s.userId, rol: 'ofis_admin' } });
    } finally {
      await shard.end();
    }
    // Aynı ad (Türkçe kurallarla büyük harf: "Ofisi" → "OFİSİ") ikinci kez açılmaz
    expect(await openOfficeForSale(s, { officeName: ad.toLocaleUpperCase('tr-TR'), contactName: 'X', email: `x-${randomUUID().slice(0, 8)}@eworks.test`, phone: '05321234567', plan: 'pro', trialDays: '' }, officeDeps))
      .toEqual({ ok: false, error: 'ofis_var' });
  });
});

describe('satış rolünün veri sınırı', () => {
  it('[F:satis.ofis.create] shard\'da hiçbir tabloyu okuyamaz, RLS rolüne geçemez; kontrol düzleminde VKN dizinini göremez', async () => {
    const pool = satis.pool(satis.shardIds[0] ?? 'shard-01');
    await expect(pool.query('select count(*) from organization.organizations')).rejects.toThrow(/permission denied/);
    await expect(pool.query('select count(*) from tax_filing.declarations')).rejects.toThrow(/permission denied/);
    await expect(pool.query('set role authenticated')).rejects.toThrow(/permission denied/);
    await expect(pool.query(`select audit.append(gen_random_uuid(), null, 'system', 'a.b', null, '{}')`)).rejects.toThrow(/permission denied/);
    await expect(satis.control.query('select count(*) from directory.taxpayer_registry')).rejects.toThrow(/permission denied/);
    await expect(satis.control.query(`update directory.organizations set status = 'frozen'`)).rejects.toThrow(/permission denied/);
  });

  it('portal rolü satış tablolarına erişemez', async () => {
    await expect(web.control.query('select count(*) from sales.users')).rejects.toThrow(/permission denied/);
  });
});

describe('yarışa dayanıklılık (paralel istekler sınırları aşamaz)', () => {
  it('[F:satis.oturum.mfa] aynı ara adımla 10 paralel yanlış kod: hesap kilitlenir, adım düşer', async () => {
    const s = await satisci();
    const stepId = await adimAl(s.email, s.password);
    const sonuc = await Promise.all(Array.from({ length: 10 }, () => verifySecondFactor(stepId, { code: '000000' }, authDeps)));
    expect(sonuc.every((r) => !r.ok)).toBe(true);
    const { rows } = await yonetici.query<{ locked_until: Date | null }>('select locked_until from sales.users where id = $1', [s.userId]);
    expect(rows[0]?.locked_until?.getTime() ?? 0).toBeGreaterThan(Date.now());
    expect(await redis.exists(`ew:satis:oturum:${stepId}`)).toBe(0);
    expect(await girisYap(s.email, s.password)).toEqual({ ok: false, error: 'kilitli' });
  });

  it('[F:satis.oturum.mfa] aynı geçerli kod iki paralel girişte yalnız bir kez geçer; kurtarma kodu da öyle', async () => {
    const s = await satisci();
    const [a, b] = [await adimAl(s.email, s.password), await adimAl(s.email, s.password)];
    const kodla = await Promise.all([a, b].map((id) => verifySecondFactor(id, { code: kod(s.secret, s.step + 1) }, authDeps)));
    expect(kodla.filter((r) => r.ok)).toHaveLength(1);
    const [c, d] = [await adimAl(s.email, s.password), await adimAl(s.email, s.password)];
    const kurtarma = await Promise.all([c, d].map((id) => verifySecondFactor(id, { recoveryCode: s.kurtarma[0] ?? '' }, authDeps)));
    expect(kurtarma.filter((r) => r.ok)).toHaveLength(1);
  });

  it('[F:satis.oturum.login] aynı güvenlik kodu yanıtı iki paralel istekte yalnız bir kez geçer (GETDEL)', async () => {
    const s = await satisci(false);
    const b = await beginLogin(s.email, authDeps);
    if (!b.ok) throw new Error(b.error);
    await loginCaptcha(b.value.startId, authDeps);
    const yanit = await kodYaniti(b.value.startId);
    const sonuc = await Promise.all([1, 2].map(() => salesLogin({ startId: b.value.startId, password: s.password, captcha: yanit }, authDeps)));
    expect(sonuc.filter((r) => r.ok)).toHaveLength(1);
  });

  it('[F:satis.ofis.create] kilidi yalnız alan bırakır: başka jetonla bırakma kilidi silmez', async () => {
    const kilit = new RedisLocks(redis);
    const anahtar = `test-${randomUUID()}`;
    const jeton = await kilit.acquire(anahtar, 30);
    expect(jeton).not.toBeNull();
    expect(await kilit.acquire(anahtar, 30)).toBeNull();
    await kilit.release(anahtar, 'baska-jeton');
    expect(await kilit.acquire(anahtar, 30)).toBeNull();
    await kilit.release(anahtar, jeton ?? '');
    expect(await kilit.acquire(anahtar, 30)).not.toBeNull();
  });

  it('[F:satis.ofis.create] satış rolü üyesi olan (var olan) bir ofise üye ekleyemez; yeni açtığı ofise ekler', async () => {
    const s = await satisci();
    const r = await openOfficeForSale(s, { officeName: `Kısıt ${randomUUID().slice(0, 8)}`, contactName: 'Ayşe', email: `k-${randomUUID().slice(0, 8)}@eworks.test`, phone: '05321234567', plan: 'pro', trialDays: '' }, officeDeps);
    if (!r.ok) throw new Error(r.error);
    await expect(officeDeps.tenant.addMember(r.value.orgId, { userId: randomUUID(), role: 'ofis_admin', displayName: 'Sızma' }, s.userId)).rejects.toThrow(/yeni açılan ofise/);
  });
});
