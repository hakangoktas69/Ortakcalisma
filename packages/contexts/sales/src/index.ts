// PUBLIC API — sales bağlamı: satış kullanıcıları, ofis/müşavir/mükellef hesabı açma, sözleşme ve mükellef onayı, dondurma,
// shard ataması; mükellef iş verisini görmez. Ayrıntı: docs/baglamlar/sales.md
export const CONTEXT = 'sales' as const;

export { afterFailure, isLocked, LOCK_MINUTES, MAX_FAILED, passwordProblem, validEmail } from './domain/sales-user.ts';
export {
  ACCOUNT_STATUSES,
  accountStatus,
  DEFAULT_TRIAL_DAYS,
  findPlan,
  formatPhone,
  MAX_TRIAL_DAYS,
  normalizePhone,
  PLANS,
  trialEnd,
  validateNewOffice,
  type AccountStatus,
  type NewOffice,
  type NewOfficeField,
  type NewOfficeInput,
  type Plan,
} from './domain/sales-account.ts';
export { addMember, openOffice, type Directory, type Identity, type MemberRole, type NewUser, type ProvisionDeps, type ProvisionError, type TenantProvisioner } from './application/provisioning.ts';
export {
  authorizeSales,
  beginTotpSetup,
  changeOwnPassword,
  createSalesUser,
  currentSalesSession,
  enableTotp,
  salesLogin,
  salesLogout,
  SESSION_TTL,
  STEP_TTL,
  verifySecondFactor,
  type SalesAuditEntry,
  type SalesAuditPort,
  type SalesAuthDeps,
  type SalesAuthzError,
  type SalesCrypto,
  type SalesLoginError,
  type SalesPrincipal,
  type SalesSessionData,
  type SalesSessionStore,
  type SalesUserRecord,
  type SalesUserRepository,
} from './application/sales-auth.ts';
export {
  listOffices,
  openOfficeForSale,
  type LockPort,
  type OfficeListRow,
  type OfficeSaleDeps,
  type OfficeView,
  type OpenOfficeError,
  type SalesAccountRecord,
  type SalesAccountRepository,
} from './application/offices.ts';
export { PgDirectory, PgTenantProvisioner } from './infrastructure/pg-provisioning.ts';
export { PgSalesAccounts, PgSalesAudit, PgSalesUsers } from './infrastructure/pg-sales.ts';
export { RedisLocks, RedisSalesSessionStore } from './infrastructure/redis-sales.ts';
export { NodeSalesCrypto, totpCodeAt } from './infrastructure/node-crypto.ts';
