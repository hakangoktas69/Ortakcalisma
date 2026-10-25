import { err, ok, type Clock, type Result } from '@eworks/kernel';
import { effectiveGrants, isAllowed } from '../domain/permissions.ts';
import type { AuthProvider, IdGen, MembershipReader, Session, SessionStore } from './ports.ts';

// Giriş, oturum ve yetkilendirme use-case'leri (01 §4, 05 §3.4). BFF'in asıl karar noktası `authorize`'dır.

export type LoginDeps = { auth: AuthProvider; members: MembershipReader; sessions: SessionStore; ids: IdGen };
export type LoginError = 'kimlik_hatali' | 'ofis_yok' | 'uyelik_yok' | 'eksik_bilgi';

export async function login(input: { email: string; password: string }, d: LoginDeps): Promise<Result<{ sessionId: string; csrf: string }, LoginError>> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return err('eksik_bilgi');
  const tokens = await d.auth.signIn(email, input.password);
  if (!tokens) return err('kimlik_hatali');
  const user = await d.auth.verify(tokens.accessToken);
  if (!user) return err('kimlik_hatali');
  const orgs = await d.members.orgsOf(user.id);
  const org = orgs[0];
  if (!org) return err('ofis_yok');
  const m = await d.members.membership(org.orgId, user.id);
  if (!m) return err('uyelik_yok');
  const session: Session = {
    userId: user.id,
    email: user.email,
    displayName: m.displayName,
    orgId: org.orgId,
    orgName: org.name,
    role: m.role,
    grants: effectiveGrants(m.role, m.overrides),
    tokens,
    csrf: d.ids.csrf(),
  };
  const sessionId = await d.sessions.create(session);
  return ok({ sessionId, csrf: session.csrf });
}

/** Oturumu getirir; erişim belirtecinin süresi dolmak üzereyse yeniler, yenilenemezse oturumu kapatır. */
export async function currentSession(sessionId: string | undefined, d: { auth: AuthProvider; sessions: SessionStore; clock: Clock }): Promise<Session | null> {
  if (!sessionId) return null;
  const s = await d.sessions.get(sessionId);
  if (!s) return null;
  if (s.tokens.expiresAt - d.clock.now().getTime() > 60_000) return s;
  const tokens = await d.auth.refresh(s.tokens.refreshToken);
  if (!tokens) {
    await d.sessions.destroy(sessionId);
    return null;
  }
  const next = { ...s, tokens };
  await d.sessions.replace(sessionId, next);
  return next;
}

export const logout = (sessionId: string | undefined, d: { sessions: SessionStore }) => (sessionId ? d.sessions.destroy(sessionId) : Promise.resolve());

export type AuthzError = 'oturum_yok' | 'yetki_yok' | 'csrf';

/** Yetki anahtarı denetimi; değişiklik yapan isteklerde CSRF de denetlenir (sabit zamanlı karşılaştırma). */
export function authorize(session: Session | null, key: string, opts: { csrf?: string | null; mutating?: boolean } = {}): Result<Session, AuthzError> {
  if (!session) return err('oturum_yok');
  if (opts.mutating && !safeEqual(opts.csrf ?? '', session.csrf)) return err('csrf');
  if (!isAllowed(session.grants, key)) return err('yetki_yok');
  return ok(session);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length || a.length === 0) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

/** Oturumdan veritabanı claim'leri (D34): kimlik + etkin ofis. */
export const claimsOf = (s: Session) => ({ sub: s.userId, org: s.orgId, email: s.email });
