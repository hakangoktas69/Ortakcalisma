// Gerçek yığın: satış rolleri (eworks_sales, kontrol + shard), GoTrue, Redis. Satıştan ofis açılır, müşavir geçici parolayla
// portala girer; satış rolü iş verisini veritabanı düzeyinde göremez; ofisi etkileyen işlem iki denetim kaydında.
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { GoTrueAuthProvider, login, PgMembershipReader, RedisSessionStore } from '@eworks/identity-access';
import { createPool, ShardRouter } from '@eworks/platform';
import { yigin } from '@eworks/testing';
import {
  beginTotpSetup,
  createSalesUser,
  currentSalesSession,
  enableTotp,
  listOffices,
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

/** Gerçek akışla satış kullanıcısı: aç → giriş → 2FA kur → oturum. */
async function satisci() {
  const email = `satis-${randomUUID().slice(0, 8)}@eworks.test`;
  const c = await createSalesUser({ email, fullName: 'Selin Satış' }, authDeps);
  if (!c.ok) throw new Error(c.error);
  const g = await salesLogin({ email, password: c.value.tempPassword }, authDeps);
  if (!g.ok) throw new Error(g.error);
  const k = await beginTotpSetup(g.value.stepId, authDeps);
  if (!k.ok) throw new Error(k.error);
  const step = adim();
  const e = await enableTotp(g.value.stepId, kod(k.value.secret, step), authDeps);
  if (!e.ok) throw new Error(e.error);
  const p = await currentSalesSession(e.value.sessionId, authDeps);
  if (!p) throw new Error('oturum yok');
  return { ...p, password: c.value.tempPassword, secret: k.value.secret, sessionId: e.value.sessionId, step };
}

describe('satış girişi (gerçek scrypt + TOTP + Redis)', () => {
  it('[F:satis.oturum.login] [F:satis.oturum.mfa] kurulumdan sonra ikinci girişte kod istenir; gizli anahtar veritabanında mühürlü', async () => {
    const s = await satisci();
    const { rows } = await yonetici.query<{ totp_secret_enc: string; password_hash: string }>('select totp_secret_enc, password_hash from sales.users where id = $1', [s.userId]);
    expect(rows[0]?.totp_secret_enc).not.toContain(s.secret);
    expect(rows[0]?.password_hash).toMatch(/^scrypt\$/);
    const g = await salesLogin({ email: s.email, password: s.password }, authDeps);
    expect(g).toMatchObject({ ok: true, value: { stage: 'mfa' } });
    if (!g.ok) return;
    expect(await redis.ttl(`ew:satis:oturum:${g.value.stepId}`)).toBeLessThanOrEqual(300);
    // Kurulumda kullanılan adım (ve öncesi) tekrar kullanılamaz; bir sonraki adımın kodu geçer
    expect(await verifySecondFactor(g.value.stepId, { code: kod(s.secret, s.step) }, authDeps)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(await verifySecondFactor(g.value.stepId, { code: kod(s.secret, s.step + 1) }, authDeps)).toMatchObject({ ok: true });
    const { rows: denetim } = await yonetici.query<{ action: string }>('select action from sales.audit_entries where subject = $1 order by id', [s.userId]);
    expect(denetim.map((r) => r.action)).toEqual(['satis.kullanici.acildi', 'satis.oturum.2fa_acildi', 'satis.oturum.giris', 'satis.oturum.giris']);
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
    const g = await salesLogin({ email: s.email, password: s.password }, authDeps);
    if (!g.ok) throw new Error(g.error);
    const sonuc = await Promise.all(Array.from({ length: 10 }, () => verifySecondFactor(g.value.stepId, { code: '000000' }, authDeps)));
    expect(sonuc.every((r) => !r.ok)).toBe(true);
    const { rows } = await yonetici.query<{ locked_until: Date | null }>('select locked_until from sales.users where id = $1', [s.userId]);
    expect(rows[0]?.locked_until?.getTime() ?? 0).toBeGreaterThan(Date.now());
    expect(await redis.exists(`ew:satis:oturum:${g.value.stepId}`)).toBe(0);
    expect(await salesLogin({ email: s.email, password: s.password }, authDeps)).toEqual({ ok: false, error: 'kilitli' });
  });

  it('[F:satis.oturum.mfa] aynı geçerli kod iki paralel girişte yalnız bir kez geçer; kurtarma kodu da öyle', async () => {
    const s = await satisci();
    const iki = async () => {
      const a = await salesLogin({ email: s.email, password: s.password }, authDeps);
      const b = await salesLogin({ email: s.email, password: s.password }, authDeps);
      if (!a.ok || !b.ok) throw new Error('giriş');
      return [a.value.stepId, b.value.stepId] as const;
    };
    const [a, b] = await iki();
    const kodla = await Promise.all([a, b].map((id) => verifySecondFactor(id, { code: kod(s.secret, s.step + 1) }, authDeps)));
    expect(kodla.filter((r) => r.ok)).toHaveLength(1);
    const { rows } = await yonetici.query<{ n: number }>('select cardinality(recovery_code_hashes)::int as n from sales.users where id = $1', [s.userId]);
    expect(rows[0]?.n).toBe(10);
    // Kurtarma kodu: kurulumda dönen kodlardan biri iki paralel adımda denenir
    const t = await satisciKodlariyla();
    const [c, dd] = await (async () => {
      const x = await salesLogin({ email: t.email, password: t.password }, authDeps);
      const y = await salesLogin({ email: t.email, password: t.password }, authDeps);
      if (!x.ok || !y.ok) throw new Error('giriş');
      return [x.value.stepId, y.value.stepId] as const;
    })();
    const kurtarma = await Promise.all([c, dd].map((id) => verifySecondFactor(id, { recoveryCode: t.kurtarma }, authDeps)));
    expect(kurtarma.filter((r) => r.ok)).toHaveLength(1);
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

/** Kurulumdaki kurtarma kodlarından birini de döndüren satışçı (paralel kurtarma kodu testi için). */
async function satisciKodlariyla() {
  const email = `satis-${randomUUID().slice(0, 8)}@eworks.test`;
  const c = await createSalesUser({ email, fullName: 'Selin Satış' }, authDeps);
  if (!c.ok) throw new Error(c.error);
  const g = await salesLogin({ email, password: c.value.tempPassword }, authDeps);
  if (!g.ok) throw new Error(g.error);
  const k = await beginTotpSetup(g.value.stepId, authDeps);
  if (!k.ok) throw new Error(k.error);
  const e = await enableTotp(g.value.stepId, kod(k.value.secret, adim()), authDeps);
  if (!e.ok) throw new Error(e.error);
  return { email, password: c.value.tempPassword, kurtarma: e.value.recoveryCodes[0] ?? '' };
}
