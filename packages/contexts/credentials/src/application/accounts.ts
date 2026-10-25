import { err, type Result } from '@eworks/kernel';

// Kurum hesabı use-case'leri (05 §4). Kimlik bilgisi yalnız Vault'a gider; uygulama katmanı şifreyi saklamaz, döndürmez,
// günlüğe yazmaz. Okunabilen tek şey durumdur (kayıtlı mı, ne zaman, hatalı şifre/kilit).

export type Ctx = { readonly sub: string; readonly org: string };
export type OwnerKind = 'advisor' | 'firm';
export type Institution = 'GIB' | 'SGK';

export type AccountStatus = {
  id: string;
  ownerKind: OwnerKind;
  ownerId: string;
  institution: Institution;
  status: 'active' | 'wrong_password' | 'locked' | 'disabled';
  updatedAt: string;
  lastSuccessAt: string | null;
};

export type SaveInput = { ownerKind: OwnerKind; ownerId: string; institution: Institution; username: string; password: string };
export type SaveError = 'gecersiz' | 'yetki_yok' | 'bulunamadi';

export interface CredentialRepository {
  save(ctx: Ctx, input: SaveInput): Promise<Result<{ accountId: string }, SaveError>>;
  statuses(ctx: Ctx): Promise<AccountStatus[]>;
}

export async function saveAccount(ctx: Ctx, input: SaveInput, repo: CredentialRepository): Promise<Result<{ accountId: string }, SaveError>> {
  const username = input.username.trim();
  if (!username || username.length > 256 || !input.password || input.password.length > 1024) return err('gecersiz');
  if (input.ownerKind !== 'advisor' && input.ownerKind !== 'firm') return err('gecersiz');
  if (input.institution !== 'GIB' && input.institution !== 'SGK') return err('gecersiz');
  return repo.save(ctx, { ...input, username });
}

export async function accountStatuses(ctx: Ctx, repo: CredentialRepository, owner?: { kind: OwnerKind; id: string }) {
  const all = await repo.statuses(ctx);
  return owner ? all.filter((a) => a.ownerKind === owner.kind && a.ownerId === owner.id) : all;
}

export const statusLabel = (a: AccountStatus | undefined) =>
  !a ? 'Kayıtlı değil' : a.status === 'active' ? 'Kayıtlı' : a.status === 'wrong_password' ? 'Şifre hatalı — yeniden girin' : a.status === 'locked' ? 'Kilitli' : 'Devre dışı';

