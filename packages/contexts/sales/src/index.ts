// PUBLIC API — sales bağlamı: satış kullanıcıları, ofis/müşavir/mükellef hesabı açma, sözleşme ve mükellef onayı, dondurma,
// shard ataması; mükellef iş verisini görmez. Ayrıntı: docs/baglamlar/sales.md
export const CONTEXT = 'sales' as const;

export { addMember, openOffice, type Directory, type Identity, type MemberRole, type NewUser, type ProvisionDeps, type ProvisionError, type TenantProvisioner } from './application/provisioning.ts';
export { PgDirectory, PgTenantProvisioner } from './infrastructure/pg-provisioning.ts';
