import { err, ok, type Clock, type Result } from '@eworks/kernel';
import { isLocked, passwordProblem, validEmail } from '../domain/sales-user.ts';

// Satış kullanıcısı girişi (D27, D40): e-posta + parola → zorunlu iki adımlı doğrulama (TOTP; ilk girişte kurulum) → oturum.
// Satış kullanıcıları portal kimliğinden (GoTrue) ayrıdır: kontrol düzlemindeki `sales.users`; satışçı portala, müşavir satışa giremez.
// Ara adım kısa ömürlü ve tek amaçlıdır, oturum yerine geçmez. Oturum, kullanıcı kapatılınca ya da parolası değişince düşer.
// Sınırlar yarışa dayanıklıdır: hatalı giriş sayacı, adım deneme sayısı, kullanılmış kod ve kurtarma kodu atomik güncellenir
// (paralel istekler sınırı aşamaz). Hatalı sayaç yalnız TAM başarılı girişte sıfırlanır (parolayı bilen kod tahminini bölemez).

export type SalesUserRecord = {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly passwordHash: string;
  readonly isActive: boolean;
  readonly failedLogins: number;
  readonly lockedUntil: Date | null;
  /** Mühürlü (uygulama anahtarıyla şifreli) TOTP gizli anahtarı; kod onaylanana kadar `totpEnabledAt` boştur. */
  readonly totpSecretEnc: string | null;
  readonly totpEnabledAt: Date | null;
  /** Son kabul edilen kod adımı: aynı kod ikinci kez kullanılamaz. */
  readonly totpLastStep: number | null;
  readonly recoveryCodeHashes: readonly string[];
  readonly sessionVersion: number;
  readonly mustChangePassword: boolean;
};

/** Satış denetim kaydı girdisi. Kişisel veri (e-posta, telefon) yazılmaz, kimlik yazılır. */
export type SalesAuditEntry = { salesUserId: string | null; action: string; subject: string | null; details?: Record<string, string | number> };

type UserPatch = Partial<Pick<SalesUserRecord, 'passwordHash' | 'totpSecretEnc' | 'sessionVersion' | 'mustChangePassword' | 'failedLogins' | 'lockedUntil'>>;

/** Denetim girdisi verilen her yazma, değişiklikle aynı veritabanı işleminde denetime de yazılır. */
export interface SalesUserRepository {
  byEmail(email: string): Promise<SalesUserRecord | null>;
  byId(id: string): Promise<SalesUserRecord | null>;
  insert(u: { id: string; email: string; fullName: string; passwordHash: string; mustChangePassword: boolean }, audit: SalesAuditEntry): Promise<'ok' | 'exists'>;
  update(id: string, patch: UserPatch, audit?: SalesAuditEntry): Promise<void>;
  /** Atomik: sayaç +1; eşiğe ulaşınca kilit (ve kilit denetimi). Kilit bitişini döner. */
  recordFailure(id: string, now: Date, lockAudit: SalesAuditEntry): Promise<{ lockedUntil: Date | null }>;
  /** Atomik: yalnız 2FA henüz açık değilse açar; açıldıysa true. */
  enableTotp(id: string, p: { enabledAt: Date; step: number; recoveryCodeHashes: string[] }, audit: SalesAuditEntry): Promise<boolean>;
  /** Atomik: adım son kullanılandan büyükse kaydeder ve true döner (aynı kod iki kez geçmez). */
  consumeTotpStep(id: string, step: number): Promise<boolean>;
  /** Atomik: kurtarma kodu listedeyse siler ve true döner (aynı kod iki kez geçmez). */
  consumeRecoveryCode(id: string, hash: string, audit: SalesAuditEntry): Promise<boolean>;
}

/** Kriptografi portu (altyapı: scrypt, HMAC-SHA1 TOTP, AES-256-GCM). */
export interface SalesCrypto {
  hashPassword(pw: string): Promise<string>;
  /** `hash` null ise de aynı maliyette doğrular (yanıt süresinden e-postanın kayıtlı olduğu anlaşılmasın) ve false döner. */
  verifyPassword(hash: string | null, pw: string): Promise<boolean>;
  newTotpSecret(): string;
  /** Geçerliyse kullanılan adımı, değilse null döner; `lastStep` ve öncesi reddedilir. */
  verifyTotp(secret: string, code: string, now: Date, lastStep: number | null): number | null;
  otpauthUri(secret: string, account: string): string;
  newRecoveryCodes(): string[];
  hashRecoveryCode(code: string): string;
  seal(plain: string): string;
  open(sealed: string): string;
  tempPassword(): string;
}

/** Satış denetim kaydı (kontrol düzlemi, hash zincirli); değişiklik içermeyen olaylar için (ör. giriş). */
export interface SalesAuditPort {
  record(e: SalesAuditEntry): Promise<void>;
}

export type SalesSessionData =
  | { readonly kind: 'adim'; readonly purpose: 'mfa' | 'setup'; readonly userId: string; readonly sessionVersion: number }
  | { readonly kind: 'oturum'; readonly userId: string; readonly sessionVersion: number; readonly csrf: string };

/** Oturum ve ara adım deposu (Redis). Tarayıcıya yalnız opak kimlik gider. */
export interface SalesSessionStore {
  create(data: SalesSessionData, ttlSeconds: number): Promise<string>;
  get(id: string): Promise<SalesSessionData | null>;
  replace(id: string, data: SalesSessionData): Promise<void>;
  destroy(id: string): Promise<void>;
  /** Atomik: ara adımdaki yanlış kod sayısını artırır ve yeni değeri döner. */
  incrementAttempts(id: string): Promise<number>;
}

export type SalesAuthDeps = {
  users: SalesUserRepository;
  sessions: SalesSessionStore;
  crypto: SalesCrypto;
  audit: SalesAuditPort;
  clock: Clock;
  newId: () => string;
  csrf: () => string;
};

/** Oturumdaki satış kullanıcısı (BFF'in gördüğü). */
export type SalesPrincipal = { readonly userId: string; readonly email: string; readonly fullName: string; readonly csrf: string; readonly mustChangePassword: boolean };

export const STEP_TTL = { mfa: 5 * 60, setup: 15 * 60 } as const;
export const SESSION_TTL = 8 * 60 * 60;
const MAX_STEP_ATTEMPTS = 5;

/** Satış kullanıcısı açar (ilk kullanıcı komutla; ekip ekranı sonraki aşama). Geçici parola bir kez döner, ilk girişte değişir. */
export async function createSalesUser(input: { email: string; fullName: string }, d: Pick<SalesAuthDeps, 'users' | 'crypto' | 'newId'>): Promise<Result<{ id: string; tempPassword: string }, 'gecersiz_bilgi' | 'eposta_kullanimda'>> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!validEmail(email) || !fullName || fullName.length > 200) return err('gecersiz_bilgi');
  const tempPassword = d.crypto.tempPassword();
  const id = d.newId();
  const r = await d.users.insert(
    { id, email, fullName, passwordHash: await d.crypto.hashPassword(tempPassword), mustChangePassword: true },
    { salesUserId: null, action: 'satis.kullanici.acildi', subject: id },
  );
  if (r === 'exists') return err('eposta_kullanimda');
  return ok({ id, tempPassword });
}

export type SalesLoginError = 'eksik_bilgi' | 'kimlik_hatali' | 'kilitli';

/**
 * 1. adım: parola. Başarıda ara adım kimliği (kod ya da kurulum) döner; oturum açılmaz, hatalı sayacı sıfırlanmaz.
 * Kilitli hesapta da özet hesaplanır; BFF `kilitli` ile `kimlik_hatali`'yı aynı mesajla gösterir (e-posta ele verilmez).
 */
export async function salesLogin(input: { email: string; password: string }, d: SalesAuthDeps): Promise<Result<{ stepId: string; stage: 'mfa' | 'setup' }, SalesLoginError>> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return err('eksik_bilgi');
  const now = d.clock.now();
  const u = await d.users.byEmail(email);
  if (!u) {
    await d.crypto.verifyPassword(null, input.password);
    return err('kimlik_hatali');
  }
  if (isLocked(u.lockedUntil, now)) {
    await d.crypto.verifyPassword(null, input.password);
    return err('kilitli');
  }
  if (!(await d.crypto.verifyPassword(u.passwordHash, input.password)) || !u.isActive) {
    await failure(u.id, now, d);
    return err('kimlik_hatali');
  }
  const purpose = u.totpEnabledAt ? 'mfa' : 'setup';
  const stepId = await d.sessions.create({ kind: 'adim', purpose, userId: u.id, sessionVersion: u.sessionVersion }, STEP_TTL[purpose]);
  return ok({ stepId, stage: purpose });
}

const failure = (id: string, now: Date, d: Pick<SalesAuthDeps, 'users'>) =>
  d.users.recordFailure(id, now, { salesUserId: id, action: 'satis.oturum.kilitlendi', subject: id });

/** Ara adımı ve kullanıcısını doğrular: amaç tutmalı, kullanıcı etkin, kilitsiz ve sürümü aynı olmalı. */
async function stepUser(stepId: string, purpose: 'mfa' | 'setup', d: SalesAuthDeps) {
  const s = await d.sessions.get(stepId);
  if (!s || s.kind !== 'adim' || s.purpose !== purpose) return null;
  const u = await d.users.byId(s.userId);
  if (!u || !u.isActive || u.sessionVersion !== s.sessionVersion || isLocked(u.lockedUntil, d.clock.now())) return null;
  return u;
}

async function openSession(u: SalesUserRecord, d: SalesAuthDeps) {
  await d.users.update(u.id, { failedLogins: 0, lockedUntil: null }, { salesUserId: u.id, action: 'satis.oturum.giris', subject: u.id });
  return d.sessions.create({ kind: 'oturum', userId: u.id, sessionVersion: u.sessionVersion, csrf: d.csrf() }, SESSION_TTL);
}

type StepError = 'adim_gecersiz' | 'kod_hatali';

/** Yanlış kod: kullanıcının hatalı sayacı (kilit) ve adımın deneme sayısı atomik artar; beşinci denemede adım düşer. */
async function wrongCode(stepId: string, userId: string, d: SalesAuthDeps) {
  await failure(userId, d.clock.now(), d);
  if ((await d.sessions.incrementAttempts(stepId)) >= MAX_STEP_ATTEMPTS) await d.sessions.destroy(stepId);
}

/** İlk giriş: doğrulayıcı uygulama için yeni gizli anahtar (kod onaylanana kadar etkin değil). */
export async function beginTotpSetup(stepId: string, d: SalesAuthDeps): Promise<Result<{ secret: string; uri: string }, 'adim_gecersiz'>> {
  const u = await stepUser(stepId, 'setup', d);
  if (!u || u.totpEnabledAt) return err('adim_gecersiz');
  const secret = d.crypto.newTotpSecret();
  await d.users.update(u.id, { totpSecretEnc: d.crypto.seal(secret) });
  return ok({ secret, uri: d.crypto.otpauthUri(secret, u.email) });
}

/** Kurulumu kodla onaylar; kurtarma kodları yalnız bu yanıtta bir kez görünür, sonra oturum açılır. */
export async function enableTotp(stepId: string, code: string, d: SalesAuthDeps): Promise<Result<{ sessionId: string; recoveryCodes: string[]; mustChangePassword: boolean }, StepError | 'kurulum_yok'>> {
  const u = await stepUser(stepId, 'setup', d);
  if (!u || u.totpEnabledAt) return err('adim_gecersiz');
  if (!u.totpSecretEnc) return err('kurulum_yok');
  const now = d.clock.now();
  const step = d.crypto.verifyTotp(d.crypto.open(u.totpSecretEnc), code.trim(), now, null);
  if (step === null) {
    await wrongCode(stepId, u.id, d);
    return err('kod_hatali');
  }
  const recoveryCodes = d.crypto.newRecoveryCodes();
  const acildi = await d.users.enableTotp(
    u.id,
    { enabledAt: now, step, recoveryCodeHashes: recoveryCodes.map((c) => d.crypto.hashRecoveryCode(c)) },
    { salesUserId: u.id, action: 'satis.oturum.2fa_acildi', subject: u.id },
  );
  await d.sessions.destroy(stepId);
  // Eşzamanlı ikinci onay: ilki kazandı, bu yanıtın kurtarma kodları geçersiz olurdu
  if (!acildi) return err('adim_gecersiz');
  return ok({ sessionId: await openSession(u, d), recoveryCodes, mustChangePassword: u.mustChangePassword });
}

/** 2. adım: doğrulayıcı kodu ya da tek kullanımlık kurtarma kodu. */
export async function verifySecondFactor(stepId: string, input: { code?: string; recoveryCode?: string }, d: SalesAuthDeps): Promise<Result<{ sessionId: string; mustChangePassword: boolean }, StepError>> {
  const u = await stepUser(stepId, 'mfa', d);
  const secret = u?.totpSecretEnc;
  if (!u || !secret || !u.totpEnabledAt) return err('adim_gecersiz');
  let gecti: boolean;
  if (input.recoveryCode) {
    gecti = await d.users.consumeRecoveryCode(u.id, d.crypto.hashRecoveryCode(input.recoveryCode), { salesUserId: u.id, action: 'satis.oturum.kurtarma_kodu', subject: u.id });
  } else {
    const step = d.crypto.verifyTotp(d.crypto.open(secret), (input.code ?? '').trim(), d.clock.now(), u.totpLastStep);
    gecti = step !== null && (await d.users.consumeTotpStep(u.id, step));
  }
  if (!gecti) {
    await wrongCode(stepId, u.id, d);
    return err('kod_hatali');
  }
  await d.sessions.destroy(stepId);
  return ok({ sessionId: await openSession(u, d), mustChangePassword: u.mustChangePassword });
}

/** Oturumu getirir; kullanıcı kapatıldıysa, 2FA'sı kalktıysa ya da parolası değiştiyse (sürüm) oturum silinir. */
export async function currentSalesSession(sessionId: string | undefined, d: Pick<SalesAuthDeps, 'sessions' | 'users'>): Promise<SalesPrincipal | null> {
  if (!sessionId) return null;
  const s = await d.sessions.get(sessionId);
  if (!s || s.kind !== 'oturum') return null;
  const u = await d.users.byId(s.userId);
  if (!u || !u.isActive || !u.totpEnabledAt || u.sessionVersion !== s.sessionVersion) {
    await d.sessions.destroy(sessionId);
    return null;
  }
  return { userId: u.id, email: u.email, fullName: u.fullName, csrf: s.csrf, mustChangePassword: u.mustChangePassword };
}

export const salesLogout = (sessionId: string | undefined, d: Pick<SalesAuthDeps, 'sessions'>) => (sessionId ? d.sessions.destroy(sessionId) : Promise.resolve());

/** Kendi parolasını değiştirir: diğer oturumlar düşer (sürüm artar), bu oturum yeni sürümle sürer. */
export async function changeOwnPassword(
  sessionId: string,
  p: SalesPrincipal,
  input: { current: string; next: string },
  d: SalesAuthDeps,
): Promise<Result<{ id: string }, 'kimlik_hatali' | 'parola_zayif' | 'parola_ayni'> & { message?: string }> {
  const u = await d.users.byId(p.userId);
  if (!u || !(await d.crypto.verifyPassword(u.passwordHash, input.current))) return err('kimlik_hatali');
  const problem = passwordProblem(input.next);
  if (problem) return { ...err('parola_zayif'), message: problem };
  if (input.next === input.current) return err('parola_ayni');
  const sessionVersion = u.sessionVersion + 1;
  await d.users.update(
    u.id,
    { passwordHash: await d.crypto.hashPassword(input.next), mustChangePassword: false, sessionVersion },
    { salesUserId: u.id, action: 'satis.oturum.parola_degisti', subject: u.id },
  );
  await d.sessions.replace(sessionId, { kind: 'oturum', userId: u.id, sessionVersion, csrf: p.csrf });
  return ok({ id: u.id });
}

export type SalesAuthzError = 'oturum_yok' | 'yetki_yok' | 'csrf' | 'parola_degismeli';

/**
 * Satış yetkisi: her etkin satış kullanıcısı satış işlemlerinin tamamını yapar (ekip içi rol yok; eski satış modülü gibi),
 * ama yalnız `satis.*` anahtarlarını. Geçici parolası olan önce parolasını değiştirir (yalnız `satis.oturum`).
 */
export function authorizeSales(p: SalesPrincipal | null, key: string, opts: { csrf?: string | null; mutating?: boolean } = {}): Result<SalesPrincipal, SalesAuthzError> {
  if (!p) return err('oturum_yok');
  if (opts.mutating && !safeEqual(opts.csrf ?? '', p.csrf)) return err('csrf');
  if (key !== 'satis' && !key.startsWith('satis.')) return err('yetki_yok');
  if (p.mustChangePassword && key !== 'satis.oturum' && !key.startsWith('satis.oturum.')) return err('parola_degismeli');
  return ok(p);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length || a.length === 0) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
