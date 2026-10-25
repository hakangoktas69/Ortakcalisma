import { describe, expect, it } from 'vitest';
import type { AuthProvider, MembershipReader, Session, SessionStore, Tokens } from '../../src/index.ts';
import { authorize, currentSession, login, logout } from '../../src/index.ts';

const NOW = new Date('2026-10-25T10:00:00Z');
const tok = (n: number, exp = NOW.getTime() + 3_600_000): Tokens => ({ accessToken: `a${n}`, refreshToken: `r${n}`, expiresAt: exp });

function fakes(opts: { orgs?: { orgId: string; name: string }[]; role?: 'musavir' | 'personel' | null; refreshOk?: boolean } = {}) {
  const store = new Map<string, Session>();
  const auth: AuthProvider = {
    signIn: async (e, p) => (e === 'musavir@eworks.test' && p === 'dogru-parola-123' ? tok(1) : null),
    refresh: async (r) => (opts.refreshOk === false ? null : r === 'r1' ? tok(2) : null),
    verify: async (a) => (a.startsWith('a') ? { id: 'u-1', email: 'musavir@eworks.test' } : null),
    createUser: async () => 'exists',
  };
  const members: MembershipReader = {
    staff: async () => [],
    orgsOf: async () => opts.orgs ?? [{ orgId: 'o-1', name: 'Ofis' }],
    membership: async () => (opts.role === null ? null : { role: opts.role ?? 'musavir', displayName: 'Ad Soyad', overrides: [{ key: 'sgk', effect: 'deny' }] }),
  };
  const sessions: SessionStore = {
    create: async (s) => {
      store.set('sid', s);
      return 'sid';
    },
    get: async (id) => store.get(id) ?? null,
    replace: async (id, s) => void store.set(id, s),
    destroy: async (id) => void store.delete(id),
  };
  return { auth, members, sessions, store, ids: { csrf: () => 'csrf-belirteci' }, clock: { now: () => NOW } };
}

describe('[F:oturum.giris.login] giriş', () => {
  it('doğru bilgiyle oturum açar; rol şablonu ve kişiye özel engel etkin yetkiye işlenir', async () => {
    const d = fakes();
    const r = await login({ email: ' Musavir@Eworks.test ', password: 'dogru-parola-123' }, d);
    expect(r).toEqual({ ok: true, value: { sessionId: 'sid', csrf: 'csrf-belirteci' } });
    const s = d.store.get('sid')!;
    expect(s).toMatchObject({ userId: 'u-1', orgId: 'o-1', role: 'musavir' });
    expect(authorize(s, 'firmalar.liste.view').ok).toBe(true);
    expect(authorize(s, 'sgk.ebildirge.view')).toEqual({ ok: false, error: 'yetki_yok' });
  });

  it('yanlış parola, ofissiz ya da üyeliksiz kullanıcı giremez; oturum açılmaz', async () => {
    expect(await login({ email: 'musavir@eworks.test', password: 'yanlis' }, fakes())).toEqual({ ok: false, error: 'kimlik_hatali' });
    expect(await login({ email: 'musavir@eworks.test', password: 'dogru-parola-123' }, fakes({ orgs: [] }))).toEqual({ ok: false, error: 'ofis_yok' });
    const d = fakes({ role: null });
    expect(await login({ email: 'musavir@eworks.test', password: 'dogru-parola-123' }, d)).toEqual({ ok: false, error: 'uyelik_yok' });
    expect(d.store.size).toBe(0);
    expect(await login({ email: '', password: 'x' }, fakes())).toEqual({ ok: false, error: 'eksik_bilgi' });
  });
});

describe('oturum ve yetkilendirme', () => {
  it('süresi dolmak üzere olan belirteci yeniler; yenilenemezse oturumu kapatır', async () => {
    const d = fakes();
    await login({ email: 'musavir@eworks.test', password: 'dogru-parola-123' }, d);
    d.store.set('sid', { ...d.store.get('sid')!, tokens: tok(1, NOW.getTime() + 30_000) });
    expect((await currentSession('sid', d))?.tokens.accessToken).toBe('a2');
    const k = fakes({ refreshOk: false });
    await login({ email: 'musavir@eworks.test', password: 'dogru-parola-123' }, k);
    k.store.set('sid', { ...k.store.get('sid')!, tokens: tok(1, NOW.getTime() + 30_000) });
    expect(await currentSession('sid', k)).toBeNull();
    expect(k.store.size).toBe(0);
    expect(await currentSession(undefined, d)).toBeNull();
  });

  it('değişiklik yapan istekte CSRF zorunlu; oturumsuz istek reddedilir; çıkış oturumu siler', async () => {
    const d = fakes();
    await login({ email: 'musavir@eworks.test', password: 'dogru-parola-123' }, d);
    const s = d.store.get('sid')!;
    expect(authorize(s, 'gorevler.create', { mutating: true, csrf: 'yanlis-belirtec' })).toEqual({ ok: false, error: 'csrf' });
    expect(authorize(s, 'gorevler.create', { mutating: true, csrf: null })).toEqual({ ok: false, error: 'csrf' });
    expect(authorize(s, 'gorevler.create', { mutating: true, csrf: 'csrf-belirteci' }).ok).toBe(true);
    expect(authorize(null, 'gorevler.view')).toEqual({ ok: false, error: 'oturum_yok' });
    await logout('sid', d);
    expect(d.store.size).toBe(0);
  });
});
