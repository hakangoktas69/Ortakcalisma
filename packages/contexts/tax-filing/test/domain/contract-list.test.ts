import { describe, expect, it } from 'vitest';
import { fakeTckn, fakeVkn, seededRandom } from '@eworks/testing';
import { groupContracts, isIntermediaryContract, type ContractRow } from '../../src/index.ts';

const rnd = seededRandom(7);
const satir = (o: Partial<ContractRow> = {}): ContractRow => ({
  taxNumber: fakeVkn(rnd),
  identityNumber: '',
  name: 'Örnek Ticaret Ltd. Şti.',
  taxOffice: 'Kadıköy',
  number: 'S-1',
  date: '01.01.2026',
  service: 'Beyanname gönderimi',
  registeredAt: '01.01.2026',
  type: 'Aracılık ve Sorumluluk Sözleşmesi',
  ...o,
});

describe('GİB sözleşme listesi', () => {
  it('mükellef bazında gruplar; VKN yoksa TCKN kimliktir', () => {
    const vkn = fakeVkn(rnd);
    const tckn = fakeTckn(rnd);
    const r = groupContracts({ count: 3, contracts: [satir({ taxNumber: vkn, number: 'A' }), satir({ taxNumber: vkn, number: 'B' }), satir({ taxNumber: '', identityNumber: tckn })] });
    expect(r.ok && r.groups.map((g) => [g.taxId, g.contracts.length])).toEqual([
      [vkn, 2],
      [tckn, 1],
    ]);
  });

  it('fail-closed: sayı tutmazsa, kimlik biçimi bozuksa, alan eksikse ya da sözleşme tekrarlanırsa hiç uygulanmaz', () => {
    const s = satir();
    expect(groupContracts({ count: 2, contracts: [s] })).toEqual({ ok: false, error: 'sayi_uyusmuyor' });
    expect(groupContracts({ count: 0, contracts: [] })).toEqual({ ok: false, error: 'sayi_uyusmuyor' });
    expect(groupContracts({ count: 1, contracts: [satir({ taxNumber: '12AB' })] })).toEqual({ ok: false, error: 'kimlik_gecersiz' });
    expect(groupContracts({ count: 1, contracts: [satir({ taxNumber: '', identityNumber: '' })] })).toEqual({ ok: false, error: 'kimlik_gecersiz' });
    expect(groupContracts({ count: 1, contracts: [satir({ name: ' ' })] })).toEqual({ ok: false, error: 'eksik_alan' });
    expect(groupContracts({ count: 2, contracts: [s, { ...s }] })).toEqual({ ok: false, error: 'tekrarlanan_sozlesme' });
  });

  it('beyanname erişim kanıtı yalnız Aracılık ve Sorumluluk sözleşmesidir', () => {
    expect(isIntermediaryContract('Aracılık ve Sorumluluk Sözleşmesi')).toBe(true);
    expect(isIntermediaryContract('Hizmet Sözleşmesi')).toBe(false);
    expect(isIntermediaryContract(null)).toBe(false);
  });
});
