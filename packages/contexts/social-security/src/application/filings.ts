import { checkFilings, type SgkFilingRecord } from '../domain/filing.ts';

// SGK bildirimlerini uygular (işçi, sistem bağlamı) ve listeler. Belgeler documents bağlamına port üzerinden kaydedilir.

export type Ctx = { readonly sub?: string; readonly org: string };

export type StoredFiling = {
  id: string;
  firmId: string;
  firmTitle: string;
  taxId: string;
  declarationId: string;
  workplace: string;
  period: string;
  status: string;
  employeeCount: number | null;
  source: 'gib_live' | 'sahte_gib';
};

export type FilingMeta = { source: 'gib_live' | 'sahte_gib'; jobId: string };

export interface FilingRepository {
  upsert(ctx: Ctx, firmId: string, declarationId: string, r: SgkFilingRecord, m: FilingMeta): Promise<{ id: string }>;
  list(ctx: Ctx, filter: { q?: string | undefined; year?: number | undefined; limit?: number | undefined }): Promise<StoredFiling[]>;
  get(ctx: Ctx, id: string): Promise<StoredFiling | null>;
}

export interface FilingDocumentPort {
  register(
    ctx: Ctx,
    docs: { firmId: string; subjectId: string; kind: 'sgk_accrual' | 'sgk_service'; key: string; sha256: string; size: number; source: 'gib_live' | 'sahte_gib'; jobId: string }[],
  ): Promise<number>;
}

export type FilingSummary = { bildirim: number; belge: number; gecersiz: number };

/** Bir MUHSGK beyannamesinin SGK satırları. Satırlar doğrulanmazsa hiçbiri yazılmaz, sayılır. */
export async function importFilings(
  ctx: Ctx,
  input: { firmId: string; declarationId: string; parent: { periodStart: string; periodEnd: string }; rows: readonly SgkFilingRecord[] } & FilingMeta,
  d: { filings: FilingRepository; documents: FilingDocumentPort },
): Promise<FilingSummary> {
  const s: FilingSummary = { bildirim: 0, belge: 0, gecersiz: 0 };
  if (!checkFilings(input.rows, input.parent)) {
    s.gecersiz = 1;
    return s;
  }
  for (const r of input.rows) {
    const saved = await d.filings.upsert(ctx, input.firmId, input.declarationId, r, { source: input.source, jobId: input.jobId });
    s.bildirim++;
    if (r.documents.length) {
      s.belge += await d.documents.register(ctx, r.documents.map((x) => ({ ...x, firmId: input.firmId, subjectId: saved.id, source: input.source, jobId: input.jobId })));
    }
  }
  return s;
}

export const listFilings = (ctx: Ctx, filter: { q?: string | undefined; year?: number | undefined; limit?: number | undefined }, d: { filings: FilingRepository }) =>
  d.filings.list(ctx, filter);
export const getFiling = (ctx: Ctx, id: string, d: { filings: FilingRepository }) => d.filings.get(ctx, id);

export type SgkControlCell = { workplaces: number; employees: number | null; pending: boolean };
export type SgkControlRow = { firmId: string; firmTitle: string; cells: Record<string, SgkControlCell> };

/**
 * SGK kontrol listesi: mükellef × dönem; hücrede işyeri sayısı, toplam çalışan (her işyerinde sayı varsa) ve onaylanmamış
 * bildirim olup olmadığı. Kaydı olmayan dönem boş kalır.
 */
export function sgkControl(rows: readonly StoredFiling[], months: readonly string[]): SgkControlRow[] {
  const byFirm = new Map<string, SgkControlRow>();
  for (const r of rows) {
    if (!months.includes(r.period)) continue;
    const row = byFirm.get(r.firmId) ?? { firmId: r.firmId, firmTitle: r.firmTitle, cells: {} };
    const c = (row.cells[r.period] ??= { workplaces: 0, employees: 0, pending: false });
    c.workplaces++;
    c.employees = c.employees === null || r.employeeCount === null ? null : c.employees + r.employeeCount;
    c.pending ||= r.status !== 'Onaylandı';
    byFirm.set(r.firmId, row);
  }
  return [...byFirm.values()].sort((a, b) => a.firmTitle.localeCompare(b.firmTitle, 'tr'));
}
