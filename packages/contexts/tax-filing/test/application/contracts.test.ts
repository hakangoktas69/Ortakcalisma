import { describe, expect, it } from 'vitest';
import { fakeVkn, seededRandom } from '@eworks/testing';
import { importFilingContracts, type ContractRepository, type ContractRow, type FirmPort, type FirmRef } from '../../src/index.ts';

const rnd = seededRandom(11);
const ctx = { org: 'o-1' };
const satir = (taxNumber: string, number: string, name = 'Örnek A.Ş.'): ContractRow => ({
  taxNumber,
  identityNumber: '',
  name,
  taxOffice: 'Kadıköy',
  number,
  date: '01.01.2026',
  service: 'Beyanname',
  registeredAt: '01.01.2026',
  type: 'Aracılık ve Sorumluluk',
});

function portlar(mevcut: FirmRef[], cakisan: string[] = []) {
  const acilan: string[] = [];
  const yazilan: Array<[string, number]> = [];
  const firms: FirmPort = {
    byTaxIds: async (_c, ids) => mevcut.filter((f) => ids.includes(f.taxId)),
    create: async (_c, s) => {
      if (cakisan.includes(s.taxId)) return { ok: false, error: 'vkn_kayitli' };
      acilan.push(s.taxId);
      return { ok: true, id: `f-${s.taxId}` };
    },
    refresh: async (_c, f, s) => f.title !== s.title,
  };
  const contracts: ContractRepository = {
    upsert: async (_c, firmId, rows) => {
      yazilan.push([firmId, rows.length]);
    },
    list: async () => [],
  };
  return { firms, contracts, acilan, yazilan };
}

describe('sözleşme listesini ofise uygulama', () => {
  it('mevcut firma eşleşir, yeni mükellef firma kartı açılır, başka ofisteki VKN atlanıp sayılır', async () => {
    const [a, b, c] = [fakeVkn(rnd), fakeVkn(rnd), fakeVkn(rnd)];
    const p = portlar([{ id: 'f-a', taxId: a, title: 'Eski Unvan', taxOffice: null, source: 'gib_contract' }], [c]);
    const r = await importFilingContracts(
      ctx,
      { jobId: 'j', advisorId: 'm-1', source: 'sahte_gib', list: { count: 4, contracts: [satir(a, '1'), satir(a, '2'), satir(b, '3'), satir(c, '4')] } },
      p,
    );
    expect(r).toEqual({ ok: true, summary: { sozlesme: 4, mukellef: 3, yeni: 1, eslesen: 1, guncellenen: 1, cakisan: 1, gecersiz: 0 } });
    expect(p.acilan).toEqual([b]);
    expect(p.yazilan).toEqual([
      ['f-a', 2],
      [`f-${b}`, 1],
    ]);
  });

  it('liste geçersizse hiçbir firma ya da sözleşme yazılmaz', async () => {
    const p = portlar([]);
    const r = await importFilingContracts(ctx, { jobId: 'j', advisorId: 'm', source: 'gib_live', list: { count: 2, contracts: [satir(fakeVkn(rnd), '1')] } }, p);
    expect(r).toEqual({ ok: false, error: 'sayi_uyusmuyor' });
    expect(p.acilan).toEqual([]);
    expect(p.yazilan).toEqual([]);
  });
});
