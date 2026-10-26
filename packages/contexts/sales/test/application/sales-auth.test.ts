import { describe, expect, it } from 'vitest';
import {
  afterFailure,
  authorizeSales,
  beginTotpSetup,
  changeOwnPassword,
  createSalesUser,
  currentSalesSession,
  enableTotp,
  salesLogin,
  salesLogout,
  verifySecondFactor,
  type SalesAuthDeps,
  type SalesCrypto,
  type SalesSessionData,
  type SalesUserRecord,
} from '../../src/index.ts';

// In-memory portlar. Sahte TOTP: geçerli kod "<gizli>-<adım>" (adım = 30 sn); gerçek HMAC altyapı testindedir.
const ADIM = (d: Date) => Math.floor(d.getTime() / 30_000);

function kur(baslangic = new Date('2026-10-26T09:00:00Z')) {
  let simdi = baslangic;
  const users = new Map<string, SalesUserRecord>();
  const sessions = new Map<string, { data: SalesSessionData; ttl: number; attempts: number }>();
  const audit: { salesUserId: string | null; action: string; subject: string | null }[] = [];
  const denetle = (e?: { salesUserId: string | null; action: string; subject: string | null }) => void (e && audit.push({ salesUserId: e.salesUserId, action: e.action, subject: e.subject }));
  const guncelle = (id: string, patch: Partial<SalesUserRecord>) => {
    const u = users.get(id);
    if (u) users.set(id, { ...u, ...patch });
  };
  let n = 0;
  const crypto: SalesCrypto = {
    hashPassword: async (pw) => `h:${pw}`,
    verifyPassword: async (hash, pw) => hash === `h:${pw}`,
    newTotpSecret: () => `gizli${++n}`,
    verifyTotp: (secret, code, now, last) => {
      for (const s of [ADIM(now), ADIM(now) - 1, ADIM(now) + 1]) if ((last === null || s > last) && code === `${secret}-${s}`) return s;
      return null;
    },
    otpauthUri: (secret, account) => `otpauth://totp/${account}?secret=${secret}`,
    newRecoveryCodes: () => ['aaaa-bbbb', 'cccc-dddd'],
    hashRecoveryCode: (c) => `r:${c.trim().toLowerCase()}`,
    seal: (s) => `muhurlu:${s}`,
    open: (s) => s.replace(/^muhurlu:/, ''),
    tempPassword: () => `Gecici${++n}parola99`,
  };
  const d: SalesAuthDeps = {
    users: {
      byEmail: async (e) => [...users.values()].find((u) => u.email === e) ?? null,
      byId: async (id) => users.get(id) ?? null,
      insert: async (u, e) => {
        if ([...users.values()].some((x) => x.email === u.email)) return 'exists';
        users.set(u.id, { ...u, isActive: true, failedLogins: 0, lockedUntil: null, totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [], sessionVersion: 1 });
        denetle(e);
        return 'ok';
      },
      update: async (id, patch, e) => {
        guncelle(id, patch);
        denetle(e);
      },
      // Gerçek adaptörde tek atomik UPDATE'tir (yarış yok); burada aynı kural
      recordFailure: async (id, now, e) => {
        const u = users.get(id);
        if (!u) return { lockedUntil: null };
        const next = afterFailure(u.failedLogins, now);
        guncelle(id, next);
        if (next.lockedUntil) denetle(e);
        return { lockedUntil: next.lockedUntil };
      },
      enableTotp: async (id, p, e) => {
        const u = users.get(id);
        if (!u || u.totpEnabledAt) return false;
        guncelle(id, { totpEnabledAt: p.enabledAt, totpLastStep: p.step, recoveryCodeHashes: p.recoveryCodeHashes });
        denetle(e);
        return true;
      },
      consumeTotpStep: async (id, step) => {
        const u = users.get(id);
        if (!u || (u.totpLastStep !== null && u.totpLastStep >= step)) return false;
        guncelle(id, { totpLastStep: step });
        return true;
      },
      consumeRecoveryCode: async (id, hash, e) => {
        const u = users.get(id);
        if (!u || !u.recoveryCodeHashes.includes(hash)) return false;
        guncelle(id, { recoveryCodeHashes: u.recoveryCodeHashes.filter((x) => x !== hash) });
        denetle(e);
        return true;
      },
    },
    sessions: {
      create: async (data, ttl) => {
        const id = `s${++n}`;
        sessions.set(id, { data, ttl, attempts: 0 });
        return id;
      },
      get: async (id) => sessions.get(id)?.data ?? null,
      replace: async (id, data) => {
        const s = sessions.get(id);
        if (s) sessions.set(id, { ...s, data });
      },
      destroy: async (id) => {
        sessions.delete(id);
      },
      incrementAttempts: async (id) => {
        const s = sessions.get(id);
        if (!s) return Number.MAX_SAFE_INTEGER;
        sessions.set(id, { ...s, attempts: s.attempts + 1 });
        return s.attempts + 1;
      },
    },
    crypto,
    audit: { record: async (e) => denetle(e) },
    clock: { now: () => simdi },
    newId: () => `u${++n}`,
    csrf: () => `csrf${++n}`,
  };
  const ileri = (ms: number) => (simdi = new Date(simdi.getTime() + ms));
  const kod = (userId: string, ofset = 0) => `${crypto.open(users.get(userId)!.totpSecretEnc!)}-${ADIM(simdi) + ofset}`;
  return { d, users, sessions, audit, ileri, kod, simdi: () => simdi };
}

/** Kullanıcı açar, ilk girişte 2FA kurar; oturum kimliği ve kullanıcıyı döner. */
async function hazirKullanici(t: ReturnType<typeof kur>, email = 'satis@eworks.test') {
  const c = await createSalesUser({ email, fullName: 'Selin Satış' }, t.d);
  if (!c.ok) throw new Error(c.error);
  const g = await salesLogin({ email, password: c.value.tempPassword }, t.d);
  if (!g.ok) throw new Error(g.error);
  await beginTotpSetup(g.value.stepId, t.d);
  const e = await enableTotp(g.value.stepId, t.kod(c.value.id), t.d);
  if (!e.ok) throw new Error(e.error);
  t.ileri(31_000);
  return { id: c.value.id, password: c.value.tempPassword, sessionId: e.value.sessionId, recoveryCodes: e.value.recoveryCodes };
}

describe('satış kullanıcısı açma (komut)', () => {
  it('[F:satis.oturum.login] geçici parolayla açılır, ilk girişte parola değiştirmek zorunlu; aynı e-posta ikinci kez açılmaz', async () => {
    const t = kur();
    const r = await createSalesUser({ email: ' Satis@Eworks.TEST ', fullName: ' Selin Satış ' }, t.d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(t.users.get(r.value.id)).toMatchObject({ email: 'satis@eworks.test', fullName: 'Selin Satış', mustChangePassword: true, passwordHash: `h:${r.value.tempPassword}` });
    expect(await createSalesUser({ email: 'satis@eworks.test', fullName: 'Başka' }, t.d)).toEqual({ ok: false, error: 'eposta_kullanimda' });
    expect(await createSalesUser({ email: 'gecersiz', fullName: 'X' }, t.d)).toEqual({ ok: false, error: 'gecersiz_bilgi' });
    expect(await createSalesUser({ email: 'a@b.test', fullName: '  ' }, t.d)).toEqual({ ok: false, error: 'gecersiz_bilgi' });
    expect(t.audit.map((a) => a.action)).toEqual(['satis.kullanici.acildi']);
  });
});

describe('satış girişi (zorunlu iki adımlı doğrulama)', () => {
  it('[F:satis.oturum.login] [F:satis.oturum.mfa] ilk giriş kurulum adımına gider; kod onaylanınca kurtarma kodları bir kez verilir ve oturum açılır', async () => {
    const t = kur();
    const c = await createSalesUser({ email: 'satis@eworks.test', fullName: 'Selin Satış' }, t.d);
    if (!c.ok) throw new Error(c.error);
    const g = await salesLogin({ email: 'SATIS@eworks.test ', password: c.value.tempPassword }, t.d);
    expect(g).toMatchObject({ ok: true, value: { stage: 'setup' } });
    if (!g.ok) return;
    // Ara adım kısa ömürlüdür ve oturum yerine geçmez
    expect(t.sessions.get(g.value.stepId)?.ttl).toBe(15 * 60);
    expect(await currentSalesSession(g.value.stepId, t.d)).toBeNull();
    const kurulum = await beginTotpSetup(g.value.stepId, t.d);
    expect(kurulum).toMatchObject({ ok: true, value: { uri: expect.stringContaining('satis@eworks.test') } });
    // Gizli anahtar veritabanında mühürlü durur
    expect(t.users.get(c.value.id)?.totpSecretEnc).toMatch(/^muhurlu:/);
    expect(await enableTotp(g.value.stepId, '000000', t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    const e = await enableTotp(g.value.stepId, t.kod(c.value.id), t.d);
    expect(e).toMatchObject({ ok: true, value: { recoveryCodes: ['aaaa-bbbb', 'cccc-dddd'], mustChangePassword: true } });
    if (!e.ok) return;
    expect(t.sessions.has(g.value.stepId)).toBe(false);
    expect(t.users.get(c.value.id)?.recoveryCodeHashes).toEqual(['r:aaaa-bbbb', 'r:cccc-dddd']);
    expect(await currentSalesSession(e.value.sessionId, t.d)).toMatchObject({ userId: c.value.id, fullName: 'Selin Satış', mustChangePassword: true });
    expect(t.audit.map((a) => a.action)).toContain('satis.oturum.2fa_acildi');
  });

  it('[F:satis.oturum.mfa] kurulu kullanıcı kod adımına gider; kod bir kez kullanılır, kurtarma kodu da tek kullanımlıktır', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const g = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    expect(g).toMatchObject({ ok: true, value: { stage: 'mfa' } });
    if (!g.ok) return;
    expect(t.sessions.get(g.value.stepId)?.ttl).toBe(5 * 60);
    const kod = t.kod(k.id);
    const v = await verifySecondFactor(g.value.stepId, { code: kod }, t.d);
    expect(v.ok).toBe(true);
    // Aynı kod ikinci girişte reddedilir (tekrar oynatma)
    const g2 = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g2.ok) throw new Error(g2.error);
    expect(await verifySecondFactor(g2.value.stepId, { code: kod }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(await verifySecondFactor(g2.value.stepId, { recoveryCode: ' AAAA-BBBB ' }, t.d)).toMatchObject({ ok: true });
    const g3 = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g3.ok) throw new Error(g3.error);
    expect(await verifySecondFactor(g3.value.stepId, { recoveryCode: 'aaaa-bbbb' }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(t.audit.map((a) => a.action)).toContain('satis.oturum.kurtarma_kodu');
  });

  it('[F:satis.oturum.login] yanlış parola ve olmayan e-posta aynı hatayı verir; beşinci hatada hesap kilitlenir, süre dolunca açılır', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    expect(await salesLogin({ email: 'yok@eworks.test', password: 'herhangi-parola-1' }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    for (let i = 0; i < 4; i++) expect(await salesLogin({ email: 'satis@eworks.test', password: 'yanlis-parola-1' }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(await salesLogin({ email: 'satis@eworks.test', password: 'yanlis-parola-1' }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(t.audit.map((a) => a.action)).toContain('satis.oturum.kilitlendi');
    // Kilitliyken doğru parola da kabul edilmez
    expect(await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d)).toEqual({ ok: false, error: 'kilitli' });
    t.ileri(15 * 60_000 + 1);
    expect(await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d)).toMatchObject({ ok: true });
    expect(await salesLogin({ email: '', password: '' }, t.d)).toEqual({ ok: false, error: 'eksik_bilgi' });
  });

  it('[F:satis.oturum.mfa] ara adımda beş yanlış kod adımı düşürür ve hesabı kilitler (kod tahmini)', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const g = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g.ok) throw new Error(g.error);
    for (let i = 0; i < 5; i++) expect(await verifySecondFactor(g.value.stepId, { code: '123456' }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(t.sessions.has(g.value.stepId)).toBe(false);
    expect(await verifySecondFactor(g.value.stepId, { code: t.kod(k.id) }, t.d)).toEqual({ ok: false, error: 'adim_gecersiz' });
    expect(await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d)).toEqual({ ok: false, error: 'kilitli' });
  });

  it('[F:satis.oturum.mfa] doğru parola hatalı sayacını sıfırlamaz: parolayı bilen, kod tahminini girişlere bölerek kilidi atlatamaz', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const g = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g.ok) throw new Error(g.error);
    for (let i = 0; i < 4; i++) await verifySecondFactor(g.value.stepId, { code: '123456' }, t.d);
    const g2 = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g2.ok) throw new Error(g2.error);
    expect(await verifySecondFactor(g2.value.stepId, { code: '123456' }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d)).toEqual({ ok: false, error: 'kilitli' });
    // Tam başarılı giriş (kod da doğru) sayacı sıfırlar
    t.ileri(15 * 60_000 + 1);
    const g3 = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g3.ok) throw new Error(g3.error);
    await verifySecondFactor(g3.value.stepId, { code: '123456' }, t.d);
    expect(await verifySecondFactor(g3.value.stepId, { code: t.kod(k.id) }, t.d)).toMatchObject({ ok: true });
    expect(t.users.get(k.id)?.failedLogins).toBe(0);
  });

  it('[F:satis.oturum.login] kilitli hesapta da parola özeti hesaplanır (yanıt süresi e-postanın kayıtlı olduğunu ele vermez)', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    for (let i = 0; i < 5; i++) await salesLogin({ email: 'satis@eworks.test', password: 'yanlis-parola-1' }, t.d);
    let ozet = 0;
    const asil = t.d.crypto.verifyPassword;
    t.d.crypto.verifyPassword = async (h, p) => {
      ozet++;
      return asil(h, p);
    };
    expect(await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d)).toEqual({ ok: false, error: 'kilitli' });
    expect(ozet).toBe(1);
  });

  it('[F:satis.oturum.mfa] adım türleri karışmaz: kurulum adımıyla kod doğrulanmaz, kurulu kullanıcı yeniden kurulum yapamaz', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const g = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g.ok) throw new Error(g.error);
    expect(await beginTotpSetup(g.value.stepId, t.d)).toEqual({ ok: false, error: 'adim_gecersiz' });
    expect(await enableTotp(g.value.stepId, t.kod(k.id), t.d)).toEqual({ ok: false, error: 'adim_gecersiz' });
    expect(await verifySecondFactor('olmayan', { code: t.kod(k.id) }, t.d)).toEqual({ ok: false, error: 'adim_gecersiz' });
    expect(await verifySecondFactor(k.sessionId, { code: t.kod(k.id) }, t.d)).toEqual({ ok: false, error: 'adim_gecersiz' });
    const yeni = await createSalesUser({ email: 'yeni@eworks.test', fullName: 'Yeni' }, t.d);
    if (!yeni.ok) throw new Error(yeni.error);
    const gy = await salesLogin({ email: 'yeni@eworks.test', password: yeni.value.tempPassword }, t.d);
    if (!gy.ok) throw new Error(gy.error);
    expect(await enableTotp(gy.value.stepId, '123456', t.d)).toEqual({ ok: false, error: 'kurulum_yok' });
    expect(await verifySecondFactor(gy.value.stepId, { code: '123456' }, t.d)).toEqual({ ok: false, error: 'adim_gecersiz' });
  });

  it('[F:satis.oturum.login] kapatılan kullanıcının ve sürümü değişen oturumun geçerliliği biter; çıkış oturumu siler', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    expect(await currentSalesSession(k.sessionId, t.d)).not.toBeNull();
    t.users.set(k.id, { ...t.users.get(k.id)!, sessionVersion: 2 });
    expect(await currentSalesSession(k.sessionId, t.d)).toBeNull();
    expect(t.sessions.has(k.sessionId)).toBe(false);
    const g = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g.ok) throw new Error(g.error);
    const v = await verifySecondFactor(g.value.stepId, { code: t.kod(k.id) }, t.d);
    if (!v.ok) throw new Error(v.error);
    t.users.set(k.id, { ...t.users.get(k.id)!, isActive: false });
    expect(await currentSalesSession(v.value.sessionId, t.d)).toBeNull();
    expect(await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    t.users.set(k.id, { ...t.users.get(k.id)!, isActive: true });
    await salesLogout(undefined, t.d);
    await salesLogout(k.sessionId, t.d);
    expect(await currentSalesSession(undefined, t.d)).toBeNull();
  });

  it('[F:satis.oturum.login] geçici parola değiştirilir: eski parola doğrulanır, kural uygulanır, diğer oturumlar düşer, bu oturum sürer', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const g = await salesLogin({ email: 'satis@eworks.test', password: k.password }, t.d);
    if (!g.ok) throw new Error(g.error);
    const v = await verifySecondFactor(g.value.stepId, { code: t.kod(k.id) }, t.d);
    if (!v.ok) throw new Error(v.error);
    const s = await currentSalesSession(k.sessionId, t.d);
    if (!s) throw new Error('oturum yok');
    expect(await changeOwnPassword(k.sessionId, s, { current: 'yanlis-parola-1', next: 'YeniParola2026x' }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(await changeOwnPassword(k.sessionId, s, { current: k.password, next: 'kisa' }, t.d)).toMatchObject({ ok: false, error: 'parola_zayif', message: 'Parola en az 12 karakter olmalı.' });
    expect(await changeOwnPassword(k.sessionId, s, { current: k.password, next: k.password }, t.d)).toMatchObject({ ok: false, error: 'parola_ayni' });
    expect(await changeOwnPassword(k.sessionId, s, { current: k.password, next: 'YeniParola2026x' }, t.d)).toEqual({ ok: true, value: { id: k.id } });
    expect(t.users.get(k.id)).toMatchObject({ mustChangePassword: false, passwordHash: 'h:YeniParola2026x', sessionVersion: 2 });
    expect(await currentSalesSession(k.sessionId, t.d)).toMatchObject({ mustChangePassword: false });
    expect(await currentSalesSession(v.value.sessionId, t.d)).toBeNull();
  });
});

describe('satış yetkisi', () => {
  it('[F:satis.ofis.view] satış oturumu yalnız satis.* anahtarlarını açar; değişiklikte CSRF; parolası geçici olan önce değiştirir', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const s = await currentSalesSession(k.sessionId, t.d);
    expect(authorizeSales(null, 'satis.ofis')).toEqual({ ok: false, error: 'oturum_yok' });
    expect(authorizeSales(s, 'satis.ofis')).toEqual({ ok: false, error: 'parola_degismeli' });
    expect(authorizeSales(s, 'satis.oturum')).toMatchObject({ ok: true });
    const temiz = s && { ...s, mustChangePassword: false };
    expect(authorizeSales(temiz, 'satis.ofis')).toMatchObject({ ok: true });
    expect(authorizeSales(temiz, 'firmalar.liste.view')).toEqual({ ok: false, error: 'yetki_yok' });
    expect(authorizeSales(temiz, 'satis.ofis.create', { mutating: true, csrf: 'yanlis' })).toEqual({ ok: false, error: 'csrf' });
    expect(authorizeSales(temiz, 'satis.ofis.create', { mutating: true, csrf: temiz?.csrf ?? null })).toMatchObject({ ok: true });
  });
});
