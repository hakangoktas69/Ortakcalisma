import { describe, expect, it } from 'vitest';
import { controlMatrix, declarationsCsv, importDeclarations, recentPeriods, type StoredDeclaration } from '../../src/index.ts';

const ctx = { org: 'o-1' };
const sozlesme = { taxNumber: '1234567890', identityNumber: '', name: 'A', taxOffice: '', number: 'S-1', date: '', service: '', registeredAt: '', type: 'Aracılık ve Sorumluluk Sözleşmesi' };
const kayit = (id: string) => ({
  recordId: id,
  type: 'KDV1',
  periodStart: '2026-08',
  periodEnd: '2026-08',
  uploadedAt: '2026-09-20T10:00:00+03:00',
  taxStatus: 'Onaylandı',
  sgkStatus: '',
  branch: '0',
  reference: 'r',
  referenceType: 'source_filename' as const,
  documents: [{ kind: 'declaration' as const, key: 'k', sha256: 's', size: 200 }],
  documentWarnings: ['Tahakkuk PDF: alınamadı'],
});
const temel = { identity: '1234567890', startDate: '2026-09-01', endDate: '2026-09-30', access: { method: 'same_session_contract' as const, contractNumbers: ['S-1'] } };

describe('beyanname içe aktarımı', () => {
  it('kanıtlı sorgular yazılır; boş, başarısız, erişimsiz ve firmasız sorgular sayılır', async () => {
    const yazilan: string[] = [];
    const s = await importDeclarations(
      ctx,
      {
        jobId: 'j',
        source: 'gib_live',
        contracts: [sozlesme],
        queries: [
          { ...temel, outcome: 'ok', records: [kayit('a'), kayit('b')] },
          { ...temel, outcome: 'empty', records: [] },
          { ...temel, outcome: 'failed', records: [] },
          { ...temel, identity: '2234567890', outcome: 'no_access', records: [] },
          { ...temel, identity: '3234567890', outcome: 'ok', records: [kayit('c')], access: { method: 'same_session_contract', contractNumbers: ['S-1'] } },
        ],
      },
      {
        firms: { byTaxIds: async () => [{ id: 'f-1', taxId: '1234567890', title: 'A', taxOffice: null, source: 'gib_contract' }] },
        declarations: {
          upsert: async (_c, _f, r) => {
            yazilan.push(r.recordId);
            return { id: r.recordId, created: r.recordId === 'a' };
          },
          list: async () => [],
          get: async () => null,
          types: async () => [],
        },
        documents: { register: async (_c, d) => d.length },
      },
    );
    expect(yazilan).toEqual(['a', 'b']);
    expect(s).toEqual({ sorgu: 5, bos: 1, basarisiz: 1, erisim_yok: 2, firma_yok: 0, beyanname: 2, yeni: 1, belge: 2, belge_uyarisi: 2 });
  });
});

const satir = (o: Partial<StoredDeclaration>): StoredDeclaration => ({
  id: 'x',
  firmId: 'f-1',
  firmTitle: 'Beta',
  taxId: '1234567890',
  type: 'KDV1',
  periodStart: '2026-09',
  periodEnd: '2026-09',
  uploadedAt: '2026-10-20T07:00:00.000Z',
  taxStatus: 'Onaylandı',
  sgkStatus: '',
  source: 'gib_live',
  ...o,
});

describe('beyanname kontrol ve dışa aktarma', () => {
  it('kontrol matrisi: mükellef × dönem, hücrede türler; dönem dışı satır yok sayılır', () => {
    const m = controlMatrix(
      [satir({}), satir({ type: 'MUHSGK' }), satir({ firmId: 'f-2', firmTitle: 'Alfa', periodStart: '2026-08' }), satir({ periodStart: '2025-01' })],
      recentPeriods('2026-10-25', 3),
    );
    expect(recentPeriods('2026-01-10', 2)).toEqual(['2025-12', '2025-11']);
    expect(m.map((r) => r.firmTitle)).toEqual(['Alfa', 'Beta']);
    expect(m[1]!.cells['2026-09']).toEqual({ types: ['KDV1', 'MUHSGK'] });
    expect(m[1]!.cells['2025-01']).toBeUndefined();
  });

  it('CSV: başlıklar ve dönem etiketi', () => {
    const csv = declarationsCsv([satir({ source: 'sahte_gib' })]);
    expect(csv.startsWith('﻿"Mükellef";"VKN/TCKN";"Beyanname türü";"Dönem"')).toBe(true);
    expect(csv).toContain('"09/2026"');
    expect(csv).toContain('"Sahte GİB (demo)"');
  });
});
