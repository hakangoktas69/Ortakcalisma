import { describe, expect, it } from 'vitest';
import { accountStatuses, saveAccount, statusLabel, type CredentialRepository, type SaveInput } from '../../src/index.ts';

const ctx = { sub: 'u', org: 'o' };

function repo() {
  const kayit: SaveInput[] = [];
  const r: CredentialRepository = {
    save: async (_c, i) => {
      kayit.push(i);
      return { ok: true, value: { accountId: 'h-1' } };
    },
    statuses: async () => [
      { id: 'h-1', ownerKind: 'firm', ownerId: 'f-1', institution: 'GIB', status: 'wrong_password', updatedAt: '', lastSuccessAt: null },
      { id: 'h-2', ownerKind: 'advisor', ownerId: 'a-1', institution: 'GIB', status: 'active', updatedAt: '', lastSuccessAt: null },
    ],
  };
  return { r, kayit };
}

describe('kurum hesabı', () => {
  it('kullanıcı adını kırpar ve depoya iletir', async () => {
    const { r, kayit } = repo();
    expect(await saveAccount(ctx, { ownerKind: 'firm', ownerId: 'f-1', institution: 'GIB', username: ' 12345 ', password: 'gizli' }, r)).toEqual({ ok: true, value: { accountId: 'h-1' } });
    expect(kayit[0]?.username).toBe('12345');
  });

  it('boş/uzun bilgi, geçersiz sahip ya da kurum depoya hiç ulaşmaz', async () => {
    const { r, kayit } = repo();
    const t = { ownerKind: 'firm' as const, ownerId: 'f', institution: 'GIB' as const, username: 'u', password: 'p' };
    for (const bozuk of [{ username: ' ' }, { password: '' }, { password: 'x'.repeat(1025) }, { ownerKind: 'baska' }, { institution: 'XYZ' }]) {
      expect(await saveAccount(ctx, { ...t, ...bozuk } as SaveInput, r)).toEqual({ ok: false, error: 'gecersiz' });
    }
    expect(kayit).toEqual([]);
  });

  it('durumlar sahibe göre süzülür; hatalı şifre kullanıcıya açıkça söylenir', async () => {
    const { r } = repo();
    const f = await accountStatuses(ctx, r, { kind: 'firm', id: 'f-1' });
    expect(f.map((a) => a.id)).toEqual(['h-1']);
    expect(statusLabel(f[0])).toBe('Şifre hatalı — yeniden girin');
    expect(statusLabel(undefined)).toBe('Kayıtlı değil');
  });
});
