// PUBLIC API — identity-access bağlamı: kullanıcı, oturum, MFA, yetki ağacı, rol şablonları, kişiye özel izin, personel ataması.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/identity-access.md
export const CONTEXT = 'identity-access' as const;

export { covers, effectiveGrants, escalations, isAllowed, ROLE_TEMPLATES, ROLES, type Grants, type Override, type Role } from './domain/permissions.ts';
export type { AuthProvider, IdGen, Membership, MembershipReader, OfficeMember, Session, SessionStore, Tokens, VerifiedUser } from './application/ports.ts';
export { authorize, claimsOf, currentSession, login, logout, type AuthzError, type LoginDeps, type LoginError } from './application/session.ts';
export { GoTrueAuthProvider } from './infrastructure/gotrue.ts';
export { RedisSessionStore } from './infrastructure/redis-session-store.ts';
export { PgMembershipReader } from './infrastructure/pg-membership-reader.ts';
