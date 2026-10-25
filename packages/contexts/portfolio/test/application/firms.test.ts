import { describe, expect, it } from 'vitest';
import { fakeVkn, seededRandom } from '@eworks/testing';
import { archiveFirm, createFirm, exportFirms, listFirms, updateFirm, type Firm, type FirmDeps, type FirmRepository, type TaxpayerRegistry } from '../../src/index.ts';

const rnd = seededRandom(11);
const ctx = { sub: 'u-1', org: 'o-1' };

function fakes(opts: { insertFails?: boolean; advisor?: string | null } = {}) {
  const firms = new Map<string, Firm>();
  const registry = new Map<string, { org: string; firm: string; state: string }>();
  const audit: number[] = [];
  let n = 0;
  const repo: FirmRepository = {
    list: async (_c, arch) => [...firms.values()].filter((f) => arch || !f.archivedAt),
    get: async (_c, id) => firms.get(id) ?? null,
    myAdvisor: async () => (opts.advisor === undefined ? 'a-1' : opts.advisor),
    insert: async (_c, id, advisorId, f) => {
      if (opts.insertFails) throw new Error('db');
      firms.set(id, { ...f, id, advisorId, advisorName: 'Müşavir', source: 'manual', archivedAt: null, version: 1, updatedAt: '' });
    },
    update: async (_c, id, version, f) => {
      const e = firms.get(id);
      if (!e) return 'not_found';
      if (e.version !== version) return 'conflict';
      firms.set(id, { ...e, ...f, version: version + 1 });
      return 'ok';
    },
    archive: async (_c, id) => {
      const e = firms.get(id);
      if (!e) return false;
      firms.set(id, { ...e, archivedAt: 'şimdi' });
      return true;
    },
    recordExport: async (_c, count) => void audit.push(count),
  };
  const reg: TaxpayerRegistry = {
    reserve: async (h, org, firm) => {
      const e = registry.get(h);
      if (e && !(e.org === org && e.firm === firm)) return 'taken';
      registry.set(h, { org, firm, state: 'reserved' });
      return 'ok';
    },
    activate: async (h) => void (registry.get(h)!.state = 'active'),
    release: async (h, org, firm) => {
      const e = registry.get(h);
      if (e && e.org === org && e.firm === firm) registry.delete(h);
    },
  };
  const d: FirmDeps = { repo, registry: reg, hashTaxId: (t) => `h:${t}`, newId: () => `f-${++n}` };
  return { d, firms, registry, audit };
}

describe('firma use-case\'leri', () => {
  it('ekler: VKN rezerve edilir, kayıttan sonra aktif olur; aynı VKN ikinci kez eklenemez', async () => {
    const f = fakes();
    const vkn = fakeVkn(rnd);
    const r = await createFirm(ctx, { title: 'A Ltd', kind: 'Limited', taxId: vkn }, f.d);
    expect(r).toEqual({ ok: true, value: { id: 'f-1' } });
    expect(f.registry.get(`h:${vkn}`)).toEqual({ org: 'o-1', firm: 'f-1', state: 'active' });
    expect(await createFirm(ctx, { title: 'B Ltd', kind: 'Limited', taxId: vkn }, f.d)).toEqual({ ok: false, error: 'vkn_kayitli' });
  });

  it('kayıt başarısız olursa rezervasyon bırakılır; müşavir kaydı olmayan kullanıcı ekleyemez', async () => {
    const f = fakes({ insertFails: true });
    const vkn = fakeVkn(rnd);
    await expect(createFirm(ctx, { title: 'A', kind: 'Limited', taxId: vkn }, f.d)).rejects.toThrow();
    expect(f.registry.size).toBe(0);
    expect(await createFirm(ctx, { title: 'A', kind: 'Limited', taxId: vkn }, fakes({ advisor: null }).d)).toEqual({ ok: false, error: 'musavir_yok' });
  });

  it('VKN değişince yenisi rezerve edilir, eskisi bırakılır; eski sürümle güncelleme çakışma verir', async () => {
    const f = fakes();
    const [v1, v2] = [fakeVkn(rnd), fakeVkn(rnd)];
    await createFirm(ctx, { title: 'A', kind: 'Limited', taxId: v1 }, f.d);
    expect(await updateFirm(ctx, 'f-1', 1, { title: 'A2', kind: 'Limited', taxId: v2 }, f.d)).toEqual({ ok: true, value: { id: 'f-1' } });
    expect([...f.registry.keys()]).toEqual([`h:${v2}`]);
    expect(await updateFirm(ctx, 'f-1', 1, { title: 'A3', kind: 'Limited', taxId: v2 }, f.d)).toEqual({ ok: false, error: 'catisma' });
    expect(await updateFirm(ctx, 'yok', 1, { title: 'A3', kind: 'Limited', taxId: v2 }, f.d)).toEqual({ ok: false, error: 'bulunamadi' });
  });

  it('arşivleme veriyi silmez, listeden çıkarır ve VKN\'yi serbest bırakır', async () => {
    const f = fakes();
    const vkn = fakeVkn(rnd);
    await createFirm(ctx, { title: 'A', kind: 'Limited', taxId: vkn }, f.d);
    expect((await archiveFirm(ctx, 'f-1', f.d)).ok).toBe(true);
    expect(f.firms.get('f-1')?.archivedAt).toBeTruthy();
    expect(await listFirms(ctx, {}, f.d)).toEqual([]);
    expect(f.registry.size).toBe(0);
    expect(await archiveFirm(ctx, 'f-1', f.d)).toEqual({ ok: false, error: 'bulunamadi' });
  });

  it('[F:firmalar.liste.export] liste süzgeçleri ve CSV dışa aktarma denetim kaydıyla', async () => {
    const f = fakes();
    await createFirm(ctx, { title: 'Ankara Gıda Ltd', kind: 'Limited', taxId: fakeVkn(rnd), city: 'Ankara', status: 'Aktif' }, f.d);
    await createFirm(ctx, { title: '=CMD()', kind: 'Esnaf', taxId: fakeVkn(rnd), taxRegime: 'Basit Usul' }, f.d);
    expect((await listFirms(ctx, { q: 'ANKARA' }, f.d)).map((x) => x.title)).toEqual(['Ankara Gıda Ltd']);
    expect((await listFirms(ctx, { segment: 'simple' }, f.d)).map((x) => x.title)).toEqual(['=CMD()']);
    const csv = await exportFirms(ctx, {}, f.d);
    expect(csv.startsWith('﻿"Unvan";"Tür";"VKN/TCKN"')).toBe(true);
    expect(csv).toContain(`"'=CMD()"`);
    expect(f.audit).toEqual([2]);
  });
});
