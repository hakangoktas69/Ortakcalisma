import { err, type Result } from '@eworks/kernel';
import { validateCredential, type CredentialFieldError, type Institution, type OwnerKind } from '../domain/credential-fields.ts';

// Kurum hesabı use-case'leri (05 §4). Kimlik bilgisi yalnız Vault'a gider; uygulama katmanı şifreyi saklamaz, döndürmez,
// günlüğe yazmaz. Okunabilen tek şey durumdur (kayıtlı mı, ne zaman, hatalı şifre/kilit) ve SGK hesabının işyeri adıdır.

export type Ctx = { readonly sub?: string; readonly org: string };
export type { Institution, OwnerKind };

export type AccountStatus = {
  id: string;
  ownerKind: OwnerKind;
  ownerId: string;
  institution: Institution;
  /** SGK işyeri adı; GİB/UETS'te boş. */
  label: string;
  status: 'active' | 'wrong_password' | 'locked' | 'disabled';
  /** ISO 8601 */
  updatedAt: string;
  lastSuccessAt: string | null;
};

/** `fields` kurumun alanlarıdır (GİB: username + password; SGK: username, workplaceCode, systemPassword, workplacePassword; UETS: address + password). */
export type SaveInput = { ownerKind: string; ownerId: string; institution: string; label?: string; fields: Record<string, unknown> };
export type StoredSecret = { ownerKind: OwnerKind; ownerId: string; institution: Institution; label: string; secret: Record<string, string> };
export type SaveError = 'gecersiz' | 'yetki_yok' | 'bulunamadi';

export interface CredentialRepository {
  save(ctx: Ctx, input: StoredSecret): Promise<Result<{ accountId: string }, SaveError>>;
  statuses(ctx: Ctx): Promise<AccountStatus[]>;
  /** Kurum girişi sonucu (işçi, sistem bağlamı): hatalı şifre hesabı durdurur, başarı sayacı sıfırlar (05 §4). */
  recordLogin(ctx: Ctx, accountId: string, outcome: 'ok' | 'wrong_password'): Promise<void>;
}

export async function saveAccount(
  ctx: Ctx,
  input: SaveInput,
  repo: CredentialRepository,
): Promise<Result<{ accountId: string }, SaveError> & { errors?: CredentialFieldError[] }> {
  if (!input.ownerId) return err('gecersiz');
  const v = validateCredential(input);
  if (!v.ok) return { ok: false, error: 'gecersiz', errors: v.errors };
  return repo.save(ctx, { ownerId: input.ownerId, ...v.value });
}

export async function accountStatuses(ctx: Ctx, repo: CredentialRepository, owner?: { kind: OwnerKind; id: string }) {
  const all = await repo.statuses(ctx);
  return owner ? all.filter((a) => a.ownerKind === owner.kind && a.ownerId === owner.id) : all;
}

export const statusLabel = (a: AccountStatus | undefined) =>
  !a ? 'Kayıtlı değil' : a.status === 'active' ? 'Kayıtlı' : a.status === 'wrong_password' ? 'Şifre hatalı — yeniden girin' : a.status === 'locked' ? 'Kilitli' : 'Devre dışı';


/** Hatalı şifreli hesap bir daha denenmez (kilitlenmeyi önlemek için); kullanıcı yeni bilgi girene dek durur. */
export const recordLoginResult = (ctx: Ctx, accountId: string, outcome: 'ok' | 'wrong_password', repo: CredentialRepository) => repo.recordLogin(ctx, accountId, outcome);
