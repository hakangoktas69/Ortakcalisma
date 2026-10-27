import { describe, expect, it } from 'vitest';
import { accountStatuses, saveAccount, statusLabel, type CredentialRepository, type SaveInput, type StoredSecret } from '../../src/index.ts';

const ctx = { sub: 'u', org: 'o' };

function repo() {
  const kayit: StoredSecret[] = [];
  const r: CredentialRepository = {
    save: async (_c, i) => {
      kayit.push(i);
      return { ok: true, value: { accountId: 'h-1' } };
    },
    recordLogin: async () => {},
    statuses: async () => [
      { id: 'h-1', ownerKind: 'firm', ownerId: 'f-1', institution: 'GIB', label: '', status: 'wrong_password', updatedAt: '', lastSuccessAt: null },
      { id: 'h-2', ownerKind: 'advisor', ownerId: 'a-1', institution: 'GIB', label: '', status: 'active', updatedAt: '', lastSuccessAt: null },
      { id: 'h-3', ownerKind: 'firm', ownerId: 'f-1', institution: 'SGK', label: 'Merkez', status: 'active', updatedAt: '', lastSuccessAt: null },
    ],
  };
  return { r, kayit };
}

describe('kurum hesabı', () => {
  it('kullanıcı adını kırpar ve depoya yalnız kurumun alanlarını iletir', async () => {
    const { r, kayit } = repo();
    expect(await saveAccount(ctx, { ownerKind: 'firm', ownerId: 'f-1', institution: 'GIB', fields: { username: ' 12345 ', password: 'gizli' } }, r)).toEqual({ ok: true, value: { accountId: 'h-1' } });
    expect(kayit[0]).toEqual({ ownerKind: 'firm', ownerId: 'f-1', institution: 'GIB', label: '', secret: { username: '12345', password: 'gizli' } });
  });

  it('[F:firmalar.kurum_hesaplari.edit_credentials] SGK hesabı işyeri adıyla, dört alanla saklanır', async () => {
    const { r, kayit } = repo();
    const fields = { username: '1', workplaceCode: '2', systemPassword: 's', workplacePassword: 'i' };
    expect((await saveAccount(ctx, { ownerKind: 'firm', ownerId: 'f-1', institution: 'SGK', label: 'Şube', fields }, r)).ok).toBe(true);
    expect(kayit[0]).toMatchObject({ institution: 'SGK', label: 'Şube', secret: fields });
  });

  it('boş/uzun bilgi, geçersiz sahip ya da kurum depoya hiç ulaşmaz; hata alanları döner', async () => {
    const { r, kayit } = repo();
    const t: SaveInput = { ownerKind: 'firm', ownerId: 'f', institution: 'GIB', fields: { username: 'u', password: 'p' } };
    for (const bozuk of [
      { fields: { username: ' ', password: 'p' } },
      { fields: { username: 'u', password: '' } },
      { fields: { username: 'u', password: 'x'.repeat(1025) } },
      { ownerKind: 'baska' },
      { institution: 'XYZ' },
      { ownerId: '' },
    ]) {
      expect(await saveAccount(ctx, { ...t, ...bozuk }, r)).toMatchObject({ ok: false, error: 'gecersiz' });
    }
    expect((await saveAccount(ctx, { ...t, fields: { username: '', password: 'p' } }, r)).errors).toEqual([{ alan: 'username', mesaj: 'GİB kullanıcı kodu gerekli.' }]);
    expect(kayit).toEqual([]);
  });

  it('durumlar sahibe göre süzülür; hatalı şifre kullanıcıya açıkça söylenir', async () => {
    const { r } = repo();
    const f = await accountStatuses(ctx, r, { kind: 'firm', id: 'f-1' });
    expect(f.map((a) => a.id)).toEqual(['h-1', 'h-3']);
    expect(statusLabel(f[0])).toBe('Şifre hatalı — yeniden girin');
    expect(statusLabel(undefined)).toBe('Kayıtlı değil');
  });
});
