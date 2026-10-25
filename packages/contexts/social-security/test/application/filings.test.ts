import { describe, expect, it } from 'vitest';
import { checkFilings, importFilings, maskWorkplace, sgkControl, type SgkFilingRecord, type StoredFiling } from '../../src/index.ts';

const satir = (o: Partial<SgkFilingRecord> = {}): SgkFilingRecord => ({
  recordId: 'sgk1',
  workplace: '1'.repeat(26),
  period: '2026-08',
  status: 'Onaylandı',
  employeeCount: 4,
  documents: [{ kind: 'sgk_service', key: 'k', sha256: 's', size: 300 }],
  documentWarnings: [],
  ...o,
});
const ust = { periodStart: '2026-08', periodEnd: '2026-08' };

describe('SGK bildirimleri (MUHSGK)', () => {
  it('işyeri, dönem ve satır kimliği denetlenir; tek bozuk satır tümünü geçersiz kılar', () => {
    expect(checkFilings([satir(), satir({ recordId: 'sgk2' })], ust)).toBe(true);
    expect(checkFilings([satir({ period: '2026-07' })], ust)).toBe(false);
    expect(checkFilings([satir({ workplace: '12345' })], ust)).toBe(false);
    expect(checkFilings([satir(), satir()], ust)).toBe(false);
    expect(checkFilings([satir({ employeeCount: -1 })], ust)).toBe(false);
    expect(checkFilings([satir({ employeeCount: null })], ust)).toBe(true);
    expect(maskWorkplace('12345678901234567890123456')).toBe('1234…3456');
  });

  it('içe aktarım: bildirim ve belgeleri yazar; geçersiz listede hiçbir şey yazmaz', async () => {
    const yazilan: string[] = [];
    const d = {
      filings: { upsert: async (_c: unknown, _f: string, _d: string, r: SgkFilingRecord) => (yazilan.push(r.recordId), { id: `x-${r.recordId}` }), list: async () => [], get: async () => null },
      documents: { register: async (_c: unknown, docs: unknown[]) => docs.length },
    };
    const temel = { firmId: 'f', declarationId: 'b', parent: ust, source: 'gib_live' as const, jobId: 'j' };
    expect(await importFilings({ org: 'o' }, { ...temel, rows: [satir(), satir({ recordId: 'sgk2', documents: [] })] }, d)).toEqual({ bildirim: 2, belge: 1, gecersiz: 0 });
    expect(await importFilings({ org: 'o' }, { ...temel, rows: [satir({ period: '2025-01' })] }, d)).toEqual({ bildirim: 0, belge: 0, gecersiz: 1 });
    expect(yazilan).toEqual(['sgk1', 'sgk2']);
  });

  it('kontrol listesi: işyeri sayısı, toplam çalışan; sayısı bilinmeyen işyeri toplamı bilinmez yapar; onay bekleyen işaretlenir', () => {
    const s = (o: Partial<StoredFiling>): StoredFiling => ({
      id: 'i', firmId: 'f', firmTitle: 'A', taxId: '1', declarationId: 'b', workplace: '1', period: '2026-08', status: 'Onaylandı', employeeCount: 3, source: 'gib_live', ...o,
    });
    const m = sgkControl([s({}), s({ employeeCount: 2 }), s({ period: '2026-09', employeeCount: null, status: 'Onay bekliyor' }), s({ period: '2020-01' })], ['2026-09', '2026-08']);
    expect(m[0]!.cells['2026-08']).toEqual({ workplaces: 2, employees: 5, pending: false });
    expect(m[0]!.cells['2026-09']).toEqual({ workplaces: 1, employees: null, pending: true });
    expect(m[0]!.cells['2020-01']).toBeUndefined();
  });
});
