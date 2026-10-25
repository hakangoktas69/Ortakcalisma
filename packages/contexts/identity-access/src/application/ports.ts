import type { Grants, Override, Role } from '../domain/permissions.ts';

export type Tokens = { readonly accessToken: string; readonly refreshToken: string; readonly expiresAt: number };
export type VerifiedUser = { readonly id: string; readonly email: string };

/** Kimlik sağlayıcı portu (GoTrue). Parola ve token'lar yalnız sunucuda dolaşır. */
export interface AuthProvider {
  signIn(email: string, password: string): Promise<Tokens | null>;
  refresh(refreshToken: string): Promise<Tokens | null>;
  verify(accessToken: string): Promise<VerifiedUser | null>;
  createUser(email: string, password: string, name: string): Promise<{ id: string } | 'exists'>;
}

export type Session = {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly orgId: string;
  readonly orgName: string;
  readonly role: Role;
  readonly grants: Grants;
  readonly tokens: Tokens;
  /** CSRF belirteci: değişiklik yapan her BFF isteği bunu `x-csrf-token` başlığında/form alanında getirir. */
  readonly csrf: string;
};

/** Oturum deposu (Redis). Tarayıcıya yalnız opak oturum kimliği gider. */
export interface SessionStore {
  create(session: Session): Promise<string>;
  get(id: string): Promise<Session | null>;
  replace(id: string, session: Session): Promise<void>;
  destroy(id: string): Promise<void>;
}

export type Membership = { readonly role: Role; readonly displayName: string; readonly overrides: readonly Override[] };

/** Üyelik okuyucu: kullanıcının ofisleri kontrol düzleminden, rolü ve kişiye özel izinleri ofisin shard'ından. */
export type OfficeMember = { userId: string; displayName: string; role: Role };

export interface MembershipReader {
  orgsOf(userId: string): Promise<readonly { orgId: string; name: string }[]>;
  membership(orgId: string, userId: string): Promise<Membership | null>;
  /** Ofisin iç kullanıcıları (mükellef kullanıcıları hariç) — görev sorumlusu seçimi; okuyanın kendi claim'leriyle. */
  staff(orgId: string, userId: string): Promise<readonly OfficeMember[]>;
}

export type IdGen = { csrf(): string };
