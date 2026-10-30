import { err, type Result } from '@eworks/kernel';

// Mükellef onayı (CredentialConsent; D18, D46): müşavir ya da ofis yöneticisi mükelleften aldığı yazılı onayı tarih ve yöntemle
// beyan eder; mükellef kullanıcısı kendi firması için verebilir. Onay geri alınabilir. Firma hesabıyla çalışan iş onaysız
// açılmaz; veritabanı (credentials.secret_for_job) iş başlarken yeniden denetler. Eworks onay belgesini doğrulamaz.

export type Ctx = { readonly sub?: string; readonly org: string };
export const CONSENT_METHODS = [
  { id: 'sozlesme', title: 'Yazılı sözleşme' },
  { id: 'dilekce', title: 'Dilekçe / onay formu' },
  { id: 'eposta', title: 'E-posta' },
  { id: 'diger', title: 'Diğer yazılı yol' },
] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number]['id'];
export type Consent = { firmId: string; method: ConsentMethod; consentedOn: string; recordedAt: string; active: boolean };
type RepoError = 'yetki_yok' | 'bulunamadi';

export interface ConsentRepository {
  /** Etkin onay varsa değiştirmez (idempotent). */
  record(ctx: Ctx, firmId: string, method: ConsentMethod, consentedOn: string): Promise<Result<void, RepoError>>;
  revoke(ctx: Ctx, firmId: string): Promise<Result<void, RepoError>>;
  /** Son onay kaydı (etkin ya da geri alınmış); hiç yoksa null. */
  status(ctx: Ctx, firmId: string): Promise<Consent | null>;
  /** Etkin onayı olan firmaların kimlikleri (toplu işler için; firma başına sorgu yapılmaz). */
  activeFirmIds(ctx: Ctx): Promise<string[]>;
}

const ANAHTAR = 'firmalar.kurum_hesaplari.consent';
const GUN = /^\d{4}-\d{2}-\d{2}$/;
const gecerliGun = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return GUN.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export async function recordConsent(
  ctx: Ctx,
  i: { firmId: string; method: string; consentedOn: string; attested: boolean },
  can: (key: string) => boolean,
  repo: ConsentRepository,
  today: string,
): Promise<Result<void, RepoError | 'gecersiz' | 'beyan_yok'>> {
  if (!can(ANAHTAR)) return err('yetki_yok');
  if (i.attested !== true) return err('beyan_yok');
  const method = CONSENT_METHODS.find((m) => m.id === i.method)?.id;
  if (!method || !gecerliGun(i.consentedOn) || i.consentedOn > today || i.consentedOn < '2000-01-01') return err('gecersiz');
  return repo.record(ctx, i.firmId, method, i.consentedOn);
}

/**
 * Etkin onayı olan firmalar (küme). Toplu kurum işi açılırken firma başına `hasActiveConsent` çağırmak döngü
 * içinde sorgu demek olurdu; kapsam RLS ile zaten sınırlıdır.
 */
export const activeConsentFirmIds = async (ctx: Ctx, repo: ConsentRepository): Promise<ReadonlySet<string>> => new Set(await repo.activeFirmIds(ctx));

export async function revokeConsent(ctx: Ctx, firmId: string, can: (key: string) => boolean, repo: ConsentRepository): Promise<Result<void, RepoError>> {
  if (!can(ANAHTAR)) return err('yetki_yok');
  return repo.revoke(ctx, firmId);
}

export const consentStatus = (ctx: Ctx, firmId: string, repo: ConsentRepository) => repo.status(ctx, firmId);

/** Firma hesabıyla iş için ön koşul (BFF; işçi tarafında veritabanı ayrıca denetler). */
export const hasActiveConsent = async (ctx: Ctx, firmId: string, repo: ConsentRepository) => (await repo.status(ctx, firmId))?.active === true;

