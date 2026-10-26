import { err, ok, type Clock, type Result } from '@eworks/kernel';
import { CAPTCHA_TTL_SECONDS, captchaMatches, loginNeedsCaptcha } from '../domain/captcha.ts';
import { isLocked, passwordProblem, validEmail } from '../domain/sales-user.ts';

// Satış kullanıcısı girişi (D27, D40, D41): e-posta → parola (2FA'sız hesapta ve bilinmeyen e-postada resimli güvenlik kodu
// da; kod çözülmeden parola denenmez) → 2FA açıksa TOTP / kurtarma kodu → oturum. İki adımlı doğrulama kullanıcının
// seçimidir: "Parola ve güvenlik" sayfasından açılır, parola + güncel kodla kapatılır.
// Satış kullanıcıları portal kimliğinden (GoTrue) ayrıdır: kontrol düzlemindeki `sales.users`; satışçı portala, müşavir satışa giremez.
// Başlangıç ve ara adım kısa ömürlü ve tek amaçlıdır, oturum yerine geçmez. Oturum, kullanıcı kapatılınca ya da parolası /
// 2FA'sı değişince düşer. Sınırlar yarışa dayanıklıdır: hatalı giriş sayacı, adım deneme sayısı, kullanılmış kod, kurtarma
// kodu ve güvenlik kodu atomik tüketilir. Hatalı sayaç yalnız TAM başarılı girişte sıfırlanır.

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

type UserPatch = Partial<Pick<SalesUserRecord, 'passwordHash' | 'sessionVersion' | 'mustChangePassword' | 'failedLogins' | 'lockedUntil'>>;

/** Denetim girdisi verilen her yazma, değişiklikle aynı veritabanı işleminde denetime de yazılır. */
export interface SalesUserRepository {
  byEmail(email: string): Promise<SalesUserRecord | null>;
  byId(id: string): Promise<SalesUserRecord | null>;
  insert(u: { id: string; email: string; fullName: string; passwordHash: string; mustChangePassword: boolean }, audit: SalesAuditEntry): Promise<'ok' | 'exists'>;
  update(id: string, patch: UserPatch, audit?: SalesAuditEntry): Promise<void>;
  /** Atomik: sayaç +1; eşiğe ulaşınca kilit (ve kilit denetimi). Kilit bitişini döner. */
  recordFailure(id: string, now: Date, lockAudit: SalesAuditEntry): Promise<{ lockedUntil: Date | null }>;
  /** Atomik: 2FA kapalıysa kurulum anahtarını yazar (açık 2FA'nın anahtarı yarışta ezilmez); yazdıysa true. */
  setPendingTotpSecret(id: string, sealed: string): Promise<boolean>;
  /** Atomik: yalnız 2FA henüz açık değilse ve kurulum anahtarı varsa açar, oturum sürümünü yazar; açıldıysa true. */
  enableTotp(id: string, p: { enabledAt: Date; step: number; recoveryCodeHashes: string[]; sessionVersion: number }, audit: SalesAuditEntry): Promise<boolean>;
  /** Atomik: 2FA açıksa kapatır (anahtar, son adım, kurtarma kodları silinir) ve oturum sürümünü yazar; kapandıysa true. */
  disableTotp(id: string, sessionVersion: number, audit: SalesAuditEntry): Promise<boolean>;
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

/** Resimli güvenlik kodu üreteci (altyapı: SVG, harfler çizim olarak). */
export interface CaptchaGenerator {
  create(): { text: string; svg: string };
}

/** Satış denetim kaydı (kontrol düzlemi, hash zincirli); değişiklik içermeyen olaylar için (ör. giriş). */
export interface SalesAuditPort {
  record(e: SalesAuditEntry): Promise<void>;
}

export type SalesSessionData =
  | { readonly kind: 'baslangic'; readonly email: string; readonly captcha: boolean }
  | { readonly kind: 'adim'; readonly purpose: 'mfa'; readonly userId: string; readonly sessionVersion: number }
  | { readonly kind: 'oturum'; readonly userId: string; readonly sessionVersion: number; readonly csrf: string };

/** Oturum, başlangıç ve ara adım deposu (Redis). Tarayıcıya yalnız opak kimlik gider. */
export interface SalesSessionStore {
  create(data: SalesSessionData, ttlSeconds: number): Promise<string>;
  get(id: string): Promise<SalesSessionData | null>;
  replace(id: string, data: SalesSessionData): Promise<void>;
  destroy(id: string): Promise<void>;
  /** Atomik: ara adımdaki yanlış kod sayısını artırır ve yeni değeri döner. */
  incrementAttempts(id: string): Promise<number>;
  /** Başlangıca güvenlik kodunun yanıtını bağlar (öncekinin yerine). */
  setCaptcha(id: string, text: string, ttlSeconds: number): Promise<void>;
  /** Atomik: yanıtı okur ve siler (tek kullanımlık; doğru da olsa yanlış da olsa yeni kod gerekir). */
  takeCaptcha(id: string): Promise<string | null>;
}

export type SalesAuthDeps = {
  users: SalesUserRepository;
  sessions: SalesSessionStore;
  crypto: SalesCrypto;
  captcha: CaptchaGenerator;
  audit: SalesAuditPort;
  clock: Clock;
  newId: () => string;
  csrf: () => string;
};

/** Oturumdaki satış kullanıcısı (BFF'in gördüğü). */
export type SalesPrincipal = {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly csrf: string;
  readonly mustChangePassword: boolean;
  readonly twoFactor: boolean;
};

export const START_TTL = 10 * 60;
export const STEP_TTL = { mfa: 5 * 60 } as const;
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

/**
 * Giriş başlangıcı (e-posta adımı): hesabın güvenlik kodu isteyip istemediğine karar verilir ve kısa ömürlü bir
 * başlangıç kaydına yazılır (karar sonradan tarayıcıdan değiştirilemez). Bilinmeyen e-posta da kod ister.
 */
export async function beginLogin(email: string, d: Pick<SalesAuthDeps, 'users' | 'sessions'>): Promise<Result<{ startId: string; captcha: boolean }, 'eksik_bilgi'>> {
  const e = email.trim().toLowerCase().slice(0, 254);
  if (!e) return err('eksik_bilgi');
  const captcha = loginNeedsCaptcha(await d.users.byEmail(e));
  return ok({ startId: await d.sessions.create({ kind: 'baslangic', email: e, captcha }, START_TTL), captcha });
}

/** Giriş sayfası için başlangıç: hangi e-posta, güvenlik kodu gerekiyor mu (başlangıç yoksa ya da başka kayıtsa null). */
export async function loginStart(startId: string, d: Pick<SalesAuthDeps, 'sessions'>): Promise<{ email: string; captcha: boolean } | null> {
  const s = await d.sessions.get(startId);
  return s && s.kind === 'baslangic' ? { email: s.email, captcha: s.captcha } : null;
}

/** Başlangıç için yeni güvenlik kodu resmi (SVG); kod gerekmiyorsa ya da başlangıç yoksa null. */
export async function loginCaptcha(startId: string, d: Pick<SalesAuthDeps, 'sessions' | 'captcha'>): Promise<string | null> {
  const s = await d.sessions.get(startId);
  if (!s || s.kind !== 'baslangic' || !s.captcha) return null;
  const c = d.captcha.create();
  await d.sessions.setCaptcha(startId, c.text, CAPTCHA_TTL_SECONDS);
  return c.svg;
}

export type SalesLoginError = 'baslangic_yok' | 'eksik_bilgi' | 'kod_hatali' | 'kimlik_hatali' | 'kilitli';
export type SalesLoginStage = { stage: 'mfa'; stepId: string } | { stage: 'oturum'; sessionId: string; mustChangePassword: boolean };

/**
 * Parola adımı. Güvenlik kodu gerekiyorsa önce o doğrulanır (tek kullanımlık; yanlışsa parola hiç denenmez, sayaç işlemez).
 * 2FA'lı hesap kod adımına, 2FA'sız hesap doğrudan oturuma geçer. Hatalı sayaç burada sıfırlanmaz (yalnız tam başarıda).
 * Kilitli hesapta da özet hesaplanır; BFF `kilitli` ile `kimlik_hatali`'yı aynı mesajla gösterir (e-posta ele verilmez).
 */
export async function salesLogin(input: { startId: string; password: string; captcha?: string }, d: SalesAuthDeps): Promise<Result<SalesLoginStage, SalesLoginError>> {
  const s = await d.sessions.get(input.startId);
  if (!s || s.kind !== 'baslangic') return err('baslangic_yok');
  if (s.captcha) {
    const beklenen = await d.sessions.takeCaptcha(input.startId);
    if (!beklenen || !captchaMatches(beklenen, input.captcha ?? '')) return err('kod_hatali');
  }
  if (!input.password) return err('eksik_bilgi');
  const now = d.clock.now();
  const u = await d.users.byEmail(s.email);
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
  await d.sessions.destroy(input.startId);
  if (u.totpEnabledAt) return ok({ stage: 'mfa', stepId: await d.sessions.create({ kind: 'adim', purpose: 'mfa', userId: u.id, sessionVersion: u.sessionVersion }, STEP_TTL.mfa) });
  return ok({ stage: 'oturum', sessionId: await openSession(u, d), mustChangePassword: u.mustChangePassword });
}

const failure = (id: string, now: Date, d: Pick<SalesAuthDeps, 'users'>) =>
  d.users.recordFailure(id, now, { salesUserId: id, action: 'satis.oturum.kilitlendi', subject: id });

/** Ara adımı ve kullanıcısını doğrular: amaç tutmalı, kullanıcı etkin, kilitsiz ve sürümü aynı olmalı. */
async function stepUser(stepId: string, d: SalesAuthDeps) {
  const s = await d.sessions.get(stepId);
  if (!s || s.kind !== 'adim') return null;
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

/** Kod ya da kurtarma kodu doğruysa (atomik tüketerek) true. */
async function secondFactorOk(u: SalesUserRecord, secret: string, input: { code?: string; recoveryCode?: string }, d: SalesAuthDeps) {
  if (input.recoveryCode) {
    return d.users.consumeRecoveryCode(u.id, d.crypto.hashRecoveryCode(input.recoveryCode), { salesUserId: u.id, action: 'satis.oturum.kurtarma_kodu', subject: u.id });
  }
  const step = d.crypto.verifyTotp(d.crypto.open(secret), (input.code ?? '').trim(), d.clock.now(), u.totpLastStep);
  return step !== null && (await d.users.consumeTotpStep(u.id, step));
}

/** 2. adım: doğrulayıcı kodu ya da tek kullanımlık kurtarma kodu. */
export async function verifySecondFactor(stepId: string, input: { code?: string; recoveryCode?: string }, d: SalesAuthDeps): Promise<Result<{ sessionId: string; mustChangePassword: boolean }, StepError>> {
  const u = await stepUser(stepId, d);
  const secret = u?.totpSecretEnc;
  if (!u || !secret || !u.totpEnabledAt) return err('adim_gecersiz');
  if (!(await secondFactorOk(u, secret, input, d))) {
    await wrongCode(stepId, u.id, d);
    return err('kod_hatali');
  }
  await d.sessions.destroy(stepId);
  return ok({ sessionId: await openSession(u, d), mustChangePassword: u.mustChangePassword });
}

/** 2FA açma, 1. adım (oturumdan): yeni gizli anahtar mühürlü saklanır; kod onaylanana kadar etkin değildir. */
export async function beginTotpEnrollment(p: SalesPrincipal, d: SalesAuthDeps): Promise<Result<{ secret: string; uri: string }, 'zaten_acik'>> {
  const u = await d.users.byId(p.userId);
  if (!u || u.totpEnabledAt) return err('zaten_acik');
  const secret = d.crypto.newTotpSecret();
  if (!(await d.users.setPendingTotpSecret(u.id, d.crypto.seal(secret)))) return err('zaten_acik');
  return ok({ secret, uri: d.crypto.otpauthUri(secret, u.email) });
}

/**
 * Oturumdaki işlemi parolayla teyit eder (çalınmış oturum çerezi yetmesin). Kilitliyse ya da parola yanlışsa hata;
 * yanlış parola hatalı giriş sayacını işletir (oturumdan parola tahmini girişteki kilidi aşamaz).
 */
async function confirmPassword(u: SalesUserRecord, password: string, d: SalesAuthDeps): Promise<'kilitli' | 'kimlik_hatali' | null> {
  const now = d.clock.now();
  if (isLocked(u.lockedUntil, now)) return 'kilitli';
  if (await d.crypto.verifyPassword(u.passwordHash, password)) return null;
  await failure(u.id, now, d);
  return 'kimlik_hatali';
}

/**
 * 2FA açma, 2. adım: parola + kod doğruysa açılır; kurtarma kodları yalnız bu yanıtta bir kez döner. Parola ele geçmiş
 * olabileceği için parolayla açılmış diğer oturumlar düşer (sürüm artar), bu oturum yeni sürümle sürer.
 */
export async function confirmTotpEnrollment(
  sessionId: string,
  p: SalesPrincipal,
  input: { password: string; code: string },
  d: SalesAuthDeps,
): Promise<Result<{ recoveryCodes: string[] }, 'kurulum_yok' | 'kod_hatali' | 'zaten_acik' | 'kimlik_hatali' | 'kilitli'>> {
  const u = await d.users.byId(p.userId);
  if (!u || u.totpEnabledAt) return err('zaten_acik');
  if (!u.totpSecretEnc) return err('kurulum_yok');
  const parola = await confirmPassword(u, input.password, d);
  if (parola) return err(parola);
  const now = d.clock.now();
  const step = d.crypto.verifyTotp(d.crypto.open(u.totpSecretEnc), input.code.trim(), now, null);
  if (step === null) return err('kod_hatali');
  const recoveryCodes = d.crypto.newRecoveryCodes();
  const sessionVersion = u.sessionVersion + 1;
  const acildi = await d.users.enableTotp(
    u.id,
    { enabledAt: now, step, recoveryCodeHashes: recoveryCodes.map((c) => d.crypto.hashRecoveryCode(c)), sessionVersion },
    { salesUserId: u.id, action: 'satis.oturum.2fa_acildi', subject: u.id },
  );
  // Eşzamanlı ikinci onay: ilki kazandı, bu yanıtın kurtarma kodları geçersiz olurdu
  if (!acildi) return err('zaten_acik');
  await d.sessions.replace(sessionId, { kind: 'oturum', userId: u.id, sessionVersion, csrf: p.csrf });
  return ok({ recoveryCodes });
}

/**
 * 2FA kapatma: parola + güncel kod (ya da kurtarma kodu) ister. Kilitliyken denenemez; yanlış parola ve yanlış kod aynı
 * hatayı verir (parolanın doğru olduğu ele verilmez) ve sayacı işletir. Diğer oturumlar düşer, bu oturum yeni sürümle sürer.
 */
export async function disableTotp(
  sessionId: string,
  p: SalesPrincipal,
  input: { password: string; code?: string; recoveryCode?: string },
  d: SalesAuthDeps,
): Promise<Result<{ id: string }, 'kimlik_hatali' | 'kilitli' | 'kapali'>> {
  const u = await d.users.byId(p.userId);
  const secret = u?.totpSecretEnc;
  if (!u || !u.totpEnabledAt || !secret) return err('kapali');
  const parola = await confirmPassword(u, input.password, d);
  if (parola) return err(parola);
  if (!(await secondFactorOk(u, secret, input, d))) {
    await failure(u.id, d.clock.now(), d);
    return err('kimlik_hatali');
  }
  const sessionVersion = u.sessionVersion + 1;
  if (!(await d.users.disableTotp(u.id, sessionVersion, { salesUserId: u.id, action: 'satis.oturum.2fa_kapatildi', subject: u.id }))) return err('kapali');
  await d.sessions.replace(sessionId, { kind: 'oturum', userId: u.id, sessionVersion, csrf: p.csrf });
  return ok({ id: u.id });
}

/** Oturumu getirir; kullanıcı kapatıldıysa ya da parolası / 2FA'sı değiştiyse (sürüm) oturum silinir. */
export async function currentSalesSession(sessionId: string | undefined, d: Pick<SalesAuthDeps, 'sessions' | 'users'>): Promise<SalesPrincipal | null> {
  if (!sessionId) return null;
  const s = await d.sessions.get(sessionId);
  if (!s || s.kind !== 'oturum') return null;
  const u = await d.users.byId(s.userId);
  if (!u || !u.isActive || u.sessionVersion !== s.sessionVersion) {
    await d.sessions.destroy(sessionId);
    return null;
  }
  return { userId: u.id, email: u.email, fullName: u.fullName, csrf: s.csrf, mustChangePassword: u.mustChangePassword, twoFactor: u.totpEnabledAt !== null };
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
