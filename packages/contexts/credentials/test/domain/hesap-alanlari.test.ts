import { describe, expect, it } from 'vitest';
import { INSTITUTION_FORMS, validateCredential } from '../../src/index.ts';

// Kurum hesabı türleri (Mert 26.10 kurum bilgi kartları → yeni yapıda Vault): GİB, SGK (işyeri başına), UETS.
// Kullanıcı adı, kod ve şifrelerin hepsi sırdır; tabloya yalnız işyeri adı (etiket) ve durum yazılır. e-Devlet şifresi saklanmaz.
describe('kurum hesabı alanları', () => {
  it('GİB: kullanıcı kodu + şifre; müşavir ya da firma; etiket yok', () => {
    expect(validateCredential({ institution: 'GIB', ownerKind: 'advisor', fields: { username: ' 1234567 ', password: 's' } })).toEqual({
      ok: true,
      value: { institution: 'GIB', ownerKind: 'advisor', label: '', secret: { username: '1234567', password: 's' } },
    });
    expect(validateCredential({ institution: 'GIB', ownerKind: 'firm', label: 'Merkez', fields: { username: 'k', password: 's' } })).toMatchObject({ ok: false });
  });

  it('SGK: yalnız firmanın, işyeri adı zorunlu; dört alanın dördü de gerekli', () => {
    const tam = { username: '12345678901', workplaceCode: '1', systemPassword: 'a', workplacePassword: 'b' };
    expect(validateCredential({ institution: 'SGK', ownerKind: 'firm', label: '  Merkez   işyeri ', fields: tam })).toEqual({
      ok: true,
      value: { institution: 'SGK', ownerKind: 'firm', label: 'Merkez işyeri', secret: tam },
    });
    const r = validateCredential({ institution: 'SGK', ownerKind: 'firm', label: '', fields: { ...tam, workplacePassword: '' } });
    expect(!r.ok && r.errors.map((e) => e.alan).sort()).toEqual(['label', 'workplacePassword']);
    expect(validateCredential({ institution: 'SGK', ownerKind: 'advisor', label: 'Merkez', fields: tam })).toMatchObject({ ok: false, errors: [{ alan: 'ownerKind' }] });
  });

  it('UETS: adres + şifre, yalnız firmanın', () => {
    expect(validateCredential({ institution: 'UETS', ownerKind: 'firm', fields: { address: 'x@uets', password: 'p' } })).toMatchObject({ ok: true, value: { label: '' } });
    expect(validateCredential({ institution: 'UETS', ownerKind: 'advisor', fields: { address: 'x', password: 'p' } }).ok).toBe(false);
  });

  it('bilinmeyen kurum (ör. e-Devlet), fazladan alan, sınır aşan uzunluk reddedilir; hata girilen değeri içermez', () => {
    expect(validateCredential({ institution: 'EDEVLET', ownerKind: 'firm', fields: { username: 'a', password: 'b' } }).ok).toBe(false);
    const fazla = validateCredential({ institution: 'GIB', ownerKind: 'firm', fields: { username: 'a', password: 'b', note: 'x' } });
    expect(fazla.ok).toBe(false);
    const uzun = validateCredential({ institution: 'GIB', ownerKind: 'firm', fields: { username: 'gizli-kod-'.repeat(30), password: 'p' } });
    expect(!uzun.ok && uzun.errors.map((e) => e.alan)).toEqual(['username']);
    expect(JSON.stringify(uzun)).not.toContain('gizli-kod-');
    expect(validateCredential({ institution: 'SGK', ownerKind: 'firm', label: 'x'.repeat(81), fields: { username: 'a', workplaceCode: 'b', systemPassword: 'c', workplacePassword: 'd' } }).ok).toBe(false);
  });

  it('form tanımları: şifre alanları gizli, alan adları doğrulamayla aynı', () => {
    expect(INSTITUTION_FORMS.map((f) => f.institution)).toEqual(['GIB', 'SGK', 'UETS']);
    const sgk = INSTITUTION_FORMS.find((f) => f.institution === 'SGK')!;
    expect(sgk.labelRequired).toBe(true);
    expect(sgk.fields.filter((f) => f.secret).map((f) => f.name)).toEqual(['systemPassword', 'workplacePassword']);
  });
});
