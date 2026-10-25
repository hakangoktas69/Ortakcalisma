// PUBLIC API — credentials bağlamı: kurum hesabı, Vault, kullanım izni, mükellef onayı, kilitlenme koruması.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/credentials.md
export const CONTEXT = 'credentials' as const;

export {
  accountStatuses,
  saveAccount,
  statusLabel,
  type AccountStatus,
  type CredentialRepository,
  type Ctx,
  type Institution,
  type OwnerKind,
  type SaveError,
  type SaveInput,
} from './application/accounts.ts';
export { PgCredentialRepository } from './infrastructure/pg-credentials.ts';
