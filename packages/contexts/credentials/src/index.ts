// PUBLIC API — credentials bağlamı: kurum hesabı, Vault, kullanım izni, mükellef onayı, kilitlenme koruması.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/credentials.md
export const CONTEXT = 'credentials' as const;

export {
  accountStatuses,
  recordLoginResult,
  saveAccount,
  statusLabel,
  type AccountStatus,
  type CredentialRepository,
  type Ctx,
  type Institution,
  type OwnerKind,
  type SaveError,
  type SaveInput,
  type StoredSecret,
} from './application/accounts.ts';
export {
  CONSENT_METHODS,
  consentStatus,
  hasActiveConsent,
  recordConsent,
  revokeConsent,
  type Consent,
  type ConsentMethod,
  type ConsentRepository,
} from './application/consent.ts';
export { INSTITUTION_FORMS, LABEL_MAX, validateCredential, type CredentialFieldError, type FieldDef, type InstitutionForm } from './domain/credential-fields.ts';
export { combineLiveStatus, liveStatus, liveStatusLabel, type LiveState, type LiveStatus } from './domain/live-status.ts';
export { PgConsentRepository } from './infrastructure/pg-consents.ts';
export { PgCredentialRepository } from './infrastructure/pg-credentials.ts';
