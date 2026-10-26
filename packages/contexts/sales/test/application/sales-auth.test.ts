import { describe, expect, it } from 'vitest';
import {
  afterFailure,
  authorizeSales,
  beginLogin,
  beginTotpEnrollment,
  changeOwnPassword,
  confirmTotpEnrollment,
  createSalesUser,
  currentSalesSession,
  disableTotp,
  loginCaptcha,
  loginStart,
  salesLogin,
  salesLogout,
  verifySecondFactor,
  type SalesAuthDeps,
  type SalesCrypto,
  type SalesSessionData,
  type SalesUserRecord,
} from '../../src/index.ts';

// In-memory portlar. Sahte TOTP: geçerli kod "<gizli>-<adım>" (adım = 30 sn); gerçek HMAC altyapı testindedir.
// Sahte güvenlik kodu: her üretimde "KOD<n>" (gerçek SVG çizimi altyapıda).
const ADIM = (d: Date) => Math.floor(d.getTime() / 30_000);

function kur(baslangic = new Date('2026-10-26T09:00:00Z')) {
  let simdi = baslangic;
  const users = new Map<string, SalesUserRecord>();
  const sessions = new Map<string, { data: SalesSessionData; ttl: number; attempts: number; captcha: string | null }>();
  const audit: { salesUserId: string | null; action: string; subject: string | null }[] = [];
  const denetle = (e?: { salesUserId: string | null; action: string; subject: string | null }) => void (e && audit.push({ salesUserId: e.salesUserId, action: e.action, subject: e.subject }));
  const guncelle = (id: string, patch: Partial<SalesUserRecord>) => {
    const u = users.get(id);
    if (u) users.set(id, { ...u, ...patch });
  };
  let n = 0;
  let ozet = 0;
  const crypto: SalesCrypto = {
    hashPassword: async (pw) => `h:${pw}`,
    verifyPassword: async (hash, pw) => {
      ozet++;
      return hash === `h:${pw}`;
    },
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
      setPendingTotpSecret: async (id, sealed) => {
        const u = users.get(id);
        if (!u || u.totpEnabledAt) return false;
        guncelle(id, { totpSecretEnc: sealed });
        return true;
      },
      enableTotp: async (id, p, e) => {
        const u = users.get(id);
        if (!u || u.totpEnabledAt || !u.totpSecretEnc) return false;
        guncelle(id, { totpEnabledAt: p.enabledAt, totpLastStep: p.step, recoveryCodeHashes: p.recoveryCodeHashes, sessionVersion: p.sessionVersion });
        denetle(e);
        return true;
      },
      disableTotp: async (id, sessionVersion, e) => {
        const u = users.get(id);
        if (!u || !u.totpEnabledAt) return false;
        guncelle(id, { totpEnabledAt: null, totpSecretEnc: null, totpLastStep: null, recoveryCodeHashes: [], sessionVersion });
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
        sessions.set(id, { data, ttl, attempts: 0, captcha: null });
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
      setCaptcha: async (id, text) => {
        const s = sessions.get(id);
        if (s) sessions.set(id, { ...s, captcha: text });
      },
      // Gerçek adaptörde GETDEL: yanıt tek kullanımlık
      takeCaptcha: async (id) => {
        const s = sessions.get(id);
        if (!s) return null;
        sessions.set(id, { ...s, captcha: null });
        return s.captcha;
      },
    },
    captcha: { create: () => ({ text: `KOD${++n}`, svg: `<svg>${n}</svg>` }) },
    crypto,
    audit: { record: async (e) => denetle(e) },
    clock: { now: () => simdi },
    newId: () => `u${++n}`,
    csrf: () => `csrf${++n}`,
  };
  const ileri = (ms: number) => (simdi = new Date(simdi.getTime() + ms));
  const kod = (userId: string, ofset = 0) => `${crypto.open(users.get(userId)?.totpSecretEnc ?? '')}-${ADIM(simdi) + ofset}`;
  const captchaYaniti = (startId: string) => sessions.get(startId)?.captcha ?? '';
  return { d, users, sessions, audit, ileri, kod, captchaYaniti, simdi: () => simdi, ozet: () => ozet };
}

type T = ReturnType<typeof kur>;

/** E-posta adımı + (gerekiyorsa) güvenlik kodu + parola. Testin istediği yanıtla. */
async function giris(t: T, email: string, password: string, kodYaniti?: string) {
  const b = await beginLogin(email, t.d);
  if (!b.ok) return b;
  if (b.value.captcha) await loginCaptcha(b.value.startId, t.d);
  return salesLogin({ startId: b.value.startId, password, captcha: kodYaniti ?? t.captchaYaniti(b.value.startId) }, t.d);
}

/** Kullanıcı açar, geçici parolayla girer (2FA yok → doğrudan oturum), parolasını değiştirir. */
async function hazirKullanici(t: T, email = 'satis@eworks.test') {
  const c = await createSalesUser({ email, fullName: 'Selin Satış' }, t.d);
  if (!c.ok) throw new Error(c.error);
  const g = await giris(t, email, c.value.tempPassword);
  if (!g.ok || g.value.stage !== 'oturum') throw new Error('giriş');
  const p = await currentSalesSession(g.value.sessionId, t.d);
  if (!p) throw new Error('oturum yok');
  const parola = 'KendiParolam2026';
  const r = await changeOwnPassword(g.value.sessionId, p, { current: c.value.tempPassword, next: parola }, t.d);
  if (!r.ok) throw new Error(r.error);
  return { id: c.value.id, password: parola, sessionId: g.value.sessionId };
}

/** Oturumdaki kullanıcıya 2FA kurar; kurtarma kodlarını döner. */
async function ikiAdimAc(t: T, k: { id: string; sessionId: string; password: string }) {
  const p = await currentSalesSession(k.sessionId, t.d);
  if (!p) throw new Error('oturum yok');
  const b = await beginTotpEnrollment(p, t.d);
  if (!b.ok) throw new Error(b.error);
  const r = await confirmTotpEnrollment(k.sessionId, p, { password: k.password, code: t.kod(k.id) }, t.d);
  if (!r.ok) throw new Error(r.error);
  t.ileri(31_000);
  return r.value.recoveryCodes;
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

describe('satış girişi: 2FA isteğe bağlı, 2FA\'sız girişte güvenlik kodu (D41)', () => {
  it('[F:satis.oturum.login] 2FA\'sız hesap ve bilinmeyen e-posta güvenlik kodu ister; kod çözülmeden parola denenmez; kod tek kullanımlıktır', async () => {
    const t = kur();
    const c = await createSalesUser({ email: 'satis@eworks.test', fullName: 'Selin Satış' }, t.d);
    if (!c.ok) throw new Error(c.error);
    expect(await beginLogin('yok@eworks.test', t.d)).toMatchObject({ ok: true, value: { captcha: true } });
    const b = await beginLogin(' SATIS@eworks.test ', t.d);
    expect(b).toMatchObject({ ok: true, value: { captcha: true } });
    if (!b.ok) return;
    expect(t.sessions.get(b.value.startId)?.ttl).toBe(10 * 60);
    expect(await loginCaptcha(b.value.startId, t.d)).toMatch(/^<svg>/);
    const dogru = t.captchaYaniti(b.value.startId);
    const once = t.ozet();
    expect(await salesLogin({ startId: b.value.startId, password: c.value.tempPassword, captcha: 'YANLIS' }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    // Parola özeti hiç hesaplanmadı, hatalı giriş sayacı işlemedi
    expect(t.ozet()).toBe(once);
    expect(t.users.get(c.value.id)?.failedLogins).toBe(0);
    // Yanlış yanıt kodu tüketti: doğru yanıt da artık geçmez, yeni kod gerekir
    expect(await salesLogin({ startId: b.value.startId, password: c.value.tempPassword, captcha: dogru }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    await loginCaptcha(b.value.startId, t.d);
    const g = await salesLogin({ startId: b.value.startId, password: c.value.tempPassword, captcha: t.captchaYaniti(b.value.startId).toLowerCase() }, t.d);
    expect(g).toMatchObject({ ok: true, value: { stage: 'oturum', mustChangePassword: true } });
    // Başlangıç kaydı kullanıldı
    expect(t.sessions.has(b.value.startId)).toBe(false);
    expect(await salesLogin({ startId: 'olmayan', password: 'x', captcha: 'x' }, t.d)).toEqual({ ok: false, error: 'baslangic_yok' });
    expect(await beginLogin('  ', t.d)).toEqual({ ok: false, error: 'eksik_bilgi' });
  });

  it('[F:satis.oturum.login] giriş sayfası başlangıcın e-postasını ve kod gereğini okur; başka kayıt türü başlangıç sayılmaz', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const b = await beginLogin('satis@eworks.test', t.d);
    if (!b.ok) throw new Error(b.error);
    expect(await loginStart(b.value.startId, t.d)).toEqual({ email: 'satis@eworks.test', captcha: true });
    expect(await loginStart(k.sessionId, t.d)).toBeNull();
    expect(await loginStart('olmayan', t.d)).toBeNull();
  });

  it('[F:satis.oturum.login] 2FA\'sız oturum geçerli; satış portalında 2FA durumu oturumda görünür', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    expect(await currentSalesSession(k.sessionId, t.d)).toMatchObject({ userId: k.id, twoFactor: false, mustChangePassword: false });
    expect(t.audit.map((a) => a.action)).toEqual(['satis.kullanici.acildi', 'satis.oturum.giris', 'satis.oturum.parola_degisti']);
  });

  it('[F:satis.oturum.mfa] 2FA\'lı hesap güvenlik kodu istemez, parola sonrası kod adımına gider; kod bir kez geçer; kurtarma kodu tek kullanımlık', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    await ikiAdimAc(t, k);
    const b = await beginLogin('satis@eworks.test', t.d);
    expect(b).toMatchObject({ ok: true, value: { captcha: false } });
    if (!b.ok) return;
    expect(await loginCaptcha(b.value.startId, t.d)).toBeNull();
    const g = await salesLogin({ startId: b.value.startId, password: k.password }, t.d);
    expect(g).toMatchObject({ ok: true, value: { stage: 'mfa' } });
    if (!g.ok || g.value.stage !== 'mfa') return;
    expect(t.sessions.get(g.value.stepId)?.ttl).toBe(5 * 60);
    // Ara adım oturum yerine geçmez
    expect(await currentSalesSession(g.value.stepId, t.d)).toBeNull();
    const kod = t.kod(k.id);
    expect(await verifySecondFactor(g.value.stepId, { code: kod }, t.d)).toMatchObject({ ok: true });
    const g2 = await giris(t, 'satis@eworks.test', k.password);
    if (!g2.ok || g2.value.stage !== 'mfa') throw new Error('adım');
    expect(await verifySecondFactor(g2.value.stepId, { code: kod }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(await verifySecondFactor(g2.value.stepId, { recoveryCode: ' AAAA-BBBB ' }, t.d)).toMatchObject({ ok: true });
    const g3 = await giris(t, 'satis@eworks.test', k.password);
    if (!g3.ok || g3.value.stage !== 'mfa') throw new Error('adım');
    expect(await verifySecondFactor(g3.value.stepId, { recoveryCode: 'aaaa-bbbb' }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(t.audit.map((a) => a.action)).toContain('satis.oturum.kurtarma_kodu');
  });

  it('[F:satis.oturum.login] yanlış parola ve olmayan e-posta aynı hatayı verir; beşinci hatada kilit; kilitliyken de özet hesaplanır; süre dolunca açılır', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    expect(await giris(t, 'yok@eworks.test', 'herhangi-parola-1')).toEqual({ ok: false, error: 'kimlik_hatali' });
    for (let i = 0; i < 5; i++) expect(await giris(t, 'satis@eworks.test', 'yanlis-parola-1')).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(t.audit.map((a) => a.action)).toContain('satis.oturum.kilitlendi');
    const once = t.ozet();
    expect(await giris(t, 'satis@eworks.test', k.password)).toEqual({ ok: false, error: 'kilitli' });
    expect(t.ozet()).toBe(once + 1);
    t.ileri(15 * 60_000 + 1);
    expect(await giris(t, 'satis@eworks.test', k.password)).toMatchObject({ ok: true });
  });

  it('[F:satis.oturum.mfa] doğru parola sayacı sıfırlamaz: parolayı bilen kod tahminini bölerek kilidi atlatamaz; adımda beş yanlış kod adımı düşürür', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    await ikiAdimAc(t, k);
    const g = await giris(t, 'satis@eworks.test', k.password);
    if (!g.ok || g.value.stage !== 'mfa') throw new Error('adım');
    for (let i = 0; i < 4; i++) await verifySecondFactor(g.value.stepId, { code: '123456' }, t.d);
    const g2 = await giris(t, 'satis@eworks.test', k.password);
    if (!g2.ok || g2.value.stage !== 'mfa') throw new Error('adım');
    expect(await verifySecondFactor(g2.value.stepId, { code: '123456' }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    expect(await giris(t, 'satis@eworks.test', k.password)).toEqual({ ok: false, error: 'kilitli' });
    t.ileri(15 * 60_000 + 1);
    const g3 = await giris(t, 'satis@eworks.test', k.password);
    if (!g3.ok || g3.value.stage !== 'mfa') throw new Error('adım');
    for (let i = 0; i < 4; i++) await verifySecondFactor(g3.value.stepId, { code: '123456' }, t.d);
    t.ileri(15 * 60_000 + 1);
    await verifySecondFactor(g3.value.stepId, { code: '123456' }, t.d);
    expect(t.sessions.has(g3.value.stepId)).toBe(false);
  });

  it('[F:satis.oturum.login] kapatılan kullanıcının ve sürümü değişen oturumun geçerliliği biter; çıkış oturumu siler', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    expect(await currentSalesSession(k.sessionId, t.d)).not.toBeNull();
    t.users.set(k.id, { ...t.users.get(k.id)!, sessionVersion: 9 });
    expect(await currentSalesSession(k.sessionId, t.d)).toBeNull();
    expect(t.sessions.has(k.sessionId)).toBe(false);
    const g = await giris(t, 'satis@eworks.test', k.password);
    if (!g.ok || g.value.stage !== 'oturum') throw new Error('oturum');
    t.users.set(k.id, { ...t.users.get(k.id)!, isActive: false });
    expect(await currentSalesSession(g.value.sessionId, t.d)).toBeNull();
    expect(await giris(t, 'satis@eworks.test', k.password)).toEqual({ ok: false, error: 'kimlik_hatali' });
    await salesLogout(undefined, t.d);
    await salesLogout(g.value.sessionId, t.d);
    expect(await currentSalesSession(undefined, t.d)).toBeNull();
  });

  it('[F:satis.oturum.login] parola değişimi: eski parola doğrulanır, kural uygulanır, diğer oturumlar düşer, bu oturum sürer', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const g = await giris(t, 'satis@eworks.test', k.password);
    if (!g.ok || g.value.stage !== 'oturum') throw new Error('oturum');
    const s = await currentSalesSession(k.sessionId, t.d);
    if (!s) throw new Error('oturum yok');
    expect(await changeOwnPassword(k.sessionId, s, { current: 'yanlis-parola-1', next: 'YeniParola2026x' }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(await changeOwnPassword(k.sessionId, s, { current: k.password, next: 'kisa' }, t.d)).toMatchObject({ ok: false, error: 'parola_zayif', message: 'Parola en az 12 karakter olmalı.' });
    expect(await changeOwnPassword(k.sessionId, s, { current: k.password, next: k.password }, t.d)).toMatchObject({ ok: false, error: 'parola_ayni' });
    expect(await changeOwnPassword(k.sessionId, s, { current: k.password, next: 'YeniParola2026x' }, t.d)).toEqual({ ok: true, value: { id: k.id } });
    expect(await currentSalesSession(k.sessionId, t.d)).toMatchObject({ mustChangePassword: false });
    expect(await currentSalesSession(g.value.sessionId, t.d)).toBeNull();
  });
});

describe('2FA açma ve kapatma (D41)', () => {
  it('[F:satis.oturum.mfa] oturumdan açılır: parola ister (çalınmış oturumla açılıp sahibi dışarıda bırakılamaz); anahtar mühürlü; kurtarma kodları bir kez; diğer oturumlar düşer', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const diger = await giris(t, 'satis@eworks.test', k.password);
    if (!diger.ok || diger.value.stage !== 'oturum') throw new Error('oturum');
    const p = await currentSalesSession(k.sessionId, t.d);
    if (!p) throw new Error('oturum yok');
    expect(await confirmTotpEnrollment(k.sessionId, p, { password: k.password, code: '123456' }, t.d)).toEqual({ ok: false, error: 'kurulum_yok' });
    const b = await beginTotpEnrollment(p, t.d);
    expect(b).toMatchObject({ ok: true, value: { uri: expect.stringContaining('satis@eworks.test') } });
    expect(t.users.get(k.id)?.totpSecretEnc).toMatch(/^muhurlu:/);
    // Parolasız (çalınmış oturum) açılamaz; yanlış parola hatalı sayacı işletir
    expect(await confirmTotpEnrollment(k.sessionId, p, { password: 'yanlis-parola-1', code: t.kod(k.id) }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(t.users.get(k.id)?.failedLogins).toBe(1);
    expect(await confirmTotpEnrollment(k.sessionId, p, { password: k.password, code: '000000' }, t.d)).toEqual({ ok: false, error: 'kod_hatali' });
    const r = await confirmTotpEnrollment(k.sessionId, p, { password: k.password, code: t.kod(k.id) }, t.d);
    expect(r).toEqual({ ok: true, value: { recoveryCodes: ['aaaa-bbbb', 'cccc-dddd'] } });
    expect(t.users.get(k.id)?.recoveryCodeHashes).toEqual(['r:aaaa-bbbb', 'r:cccc-dddd']);
    expect(await currentSalesSession(k.sessionId, t.d)).toMatchObject({ twoFactor: true });
    // Parola ele geçmiş olabilir: 2FA açılınca parolayla açılmış diğer oturumlar düşer
    expect(await currentSalesSession(diger.value.sessionId, t.d)).toBeNull();
    const p2 = await currentSalesSession(k.sessionId, t.d);
    if (!p2) throw new Error('oturum yok');
    expect(await beginTotpEnrollment(p2, t.d)).toEqual({ ok: false, error: 'zaten_acik' });
    expect(t.audit.map((a) => a.action)).toContain('satis.oturum.2fa_acildi');
  });

  it("[F:satis.oturum.mfa] yarışta açık 2FA'nın anahtarı ezilmez (bekleyen anahtar yalnız 2FA kapalıyken yazılır)", async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const p = await currentSalesSession(k.sessionId, t.d);
    if (!p) throw new Error('oturum yok');
    const eski = t.users.get(k.id);
    if (!eski) throw new Error('kullanıcı yok');
    await ikiAdimAc(t, k);
    const anahtar = t.users.get(k.id)?.totpSecretEnc;
    // Okuma eski (2FA kapalı) kaydı görür, arada başka sekme 2FA'yı açmıştır
    t.d.users.byId = async () => eski;
    expect(await beginTotpEnrollment(p, t.d)).toEqual({ ok: false, error: 'zaten_acik' });
    expect(t.users.get(k.id)?.totpSecretEnc).toBe(anahtar);
  });

  it('[F:satis.oturum.mfa] kapatmak parola + güncel kod (ya da kurtarma kodu) ister; diğer oturumlar düşer, bu oturum sürer; sonraki girişte güvenlik kodu istenir', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    await ikiAdimAc(t, k);
    const g = await giris(t, 'satis@eworks.test', k.password);
    if (!g.ok || g.value.stage !== 'mfa') throw new Error('adım');
    const v = await verifySecondFactor(g.value.stepId, { code: t.kod(k.id) }, t.d);
    if (!v.ok) throw new Error(v.error);
    t.ileri(31_000);
    const p = await currentSalesSession(k.sessionId, t.d);
    if (!p) throw new Error('oturum yok');
    // Yanlış parola ve yanlış kod aynı hatayı verir (parolanın doğru olduğu ele verilmez); ikisi de sayacı işletir
    expect(await disableTotp(k.sessionId, p, { password: 'yanlis-parola-1', code: t.kod(k.id) }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(await disableTotp(k.sessionId, p, { password: k.password, code: '000000' }, t.d)).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(t.users.get(k.id)?.failedLogins).toBe(2);
    expect(await disableTotp(k.sessionId, p, { password: k.password, recoveryCode: 'cccc-dddd' }, t.d)).toEqual({ ok: true, value: { id: k.id } });
    expect(t.users.get(k.id)).toMatchObject({ totpEnabledAt: null, totpSecretEnc: null, recoveryCodeHashes: [] });
    expect(await currentSalesSession(k.sessionId, t.d)).toMatchObject({ twoFactor: false });
    expect(await currentSalesSession(v.value.sessionId, t.d)).toBeNull();
    const p2 = await currentSalesSession(k.sessionId, t.d);
    if (!p2) throw new Error('oturum yok');
    expect(await disableTotp(k.sessionId, p2, { password: k.password, code: '000000' }, t.d)).toEqual({ ok: false, error: 'kapali' });
    expect(await beginLogin('satis@eworks.test', t.d)).toMatchObject({ ok: true, value: { captcha: true } });
    expect(t.audit.map((a) => a.action)).toContain('satis.oturum.2fa_kapatildi');
  });

  it('[F:satis.oturum.mfa] kilitli hesapta 2FA kapatılamaz ve açılamaz (oturumla parola tahmini kilidi aşamaz)', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    await ikiAdimAc(t, k);
    const p = await currentSalesSession(k.sessionId, t.d);
    if (!p) throw new Error('oturum yok');
    for (let i = 0; i < 5; i++) await disableTotp(k.sessionId, p, { password: `yanlis-${i}-parola`, code: '000000' }, t.d);
    expect(await disableTotp(k.sessionId, p, { password: k.password, recoveryCode: 'aaaa-bbbb' }, t.d)).toEqual({ ok: false, error: 'kilitli' });
    expect(t.users.get(k.id)?.totpEnabledAt).not.toBeNull();
    const t2 = kur();
    const k2 = await hazirKullanici(t2);
    const p2 = await currentSalesSession(k2.sessionId, t2.d);
    if (!p2) throw new Error('oturum yok');
    await beginTotpEnrollment(p2, t2.d);
    for (let i = 0; i < 5; i++) await confirmTotpEnrollment(k2.sessionId, p2, { password: `yanlis-${i}-parola`, code: t2.kod(k2.id) }, t2.d);
    expect(await confirmTotpEnrollment(k2.sessionId, p2, { password: k2.password, code: t2.kod(k2.id) }, t2.d)).toEqual({ ok: false, error: 'kilitli' });
  });
});

describe('satış yetkisi', () => {
  it('[F:satis.ofis.view] satış oturumu yalnız satis.* anahtarlarını açar; değişiklikte CSRF; parolası geçici olan önce değiştirir', async () => {
    const t = kur();
    const k = await hazirKullanici(t);
    const s = await currentSalesSession(k.sessionId, t.d);
    expect(authorizeSales(null, 'satis.ofis')).toEqual({ ok: false, error: 'oturum_yok' });
    const gecici = s && { ...s, mustChangePassword: true };
    expect(authorizeSales(gecici, 'satis.ofis')).toEqual({ ok: false, error: 'parola_degismeli' });
    expect(authorizeSales(gecici, 'satis.oturum')).toMatchObject({ ok: true });
    expect(authorizeSales(s, 'satis.ofis')).toMatchObject({ ok: true });
    expect(authorizeSales(s, 'firmalar.liste.view')).toEqual({ ok: false, error: 'yetki_yok' });
    expect(authorizeSales(s, 'satis.ofis.create', { mutating: true, csrf: 'yanlis' })).toEqual({ ok: false, error: 'csrf' });
    expect(authorizeSales(s, 'satis.ofis.create', { mutating: true, csrf: s?.csrf ?? null })).toMatchObject({ ok: true });
  });
});
