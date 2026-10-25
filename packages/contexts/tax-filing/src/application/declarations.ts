import { toCsv } from '@eworks/kernel';
import type { ContractRow } from '../domain/contract-list.ts';
import { checkQuery, periodLabel, type DeclarationQuery, type DeclarationRecord, type DocumentKind } from '../domain/declaration.ts';
import type { Ctx, FirmPort } from './contracts.ts';

// e-Beyanname kayıtlarını ofise uygular (işçi, sistem bağlamı) ve listeler. Belgeler documents bağlamına port üzerinden
// kaydedilir (bileşim kökü işçidedir). Firma, sözleşme içe aktarımında açılmış olmalıdır; yoksa kayıt alınmaz, sayılır.

export type DeclarationMeta = { contractNumbers: string[]; source: 'gib_live' | 'sahte_gib'; jobId: string };

export type StoredDeclaration = {
  id: string;
  firmId: string;
  firmTitle: string;
  taxId: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  uploadedAt: string;
  taxStatus: string;
  sgkStatus: string;
  source: 'gib_live' | 'sahte_gib';
};

export type DeclarationFilter = { q?: string | undefined; type?: string | undefined; year?: number | undefined; firmId?: string | undefined; limit?: number | undefined };

export interface DeclarationRepository {
  upsert(ctx: Ctx, firmId: string, r: DeclarationRecord, meta: DeclarationMeta): Promise<{ id: string; created: boolean }>;
  list(ctx: Ctx, filter: DeclarationFilter): Promise<StoredDeclaration[]>;
  get(ctx: Ctx, id: string): Promise<StoredDeclaration | null>;
  types(ctx: Ctx): Promise<string[]>;
}

/** documents bağlamına giden port. */
export interface DocumentPort {
  register(
    ctx: Ctx,
    docs: { firmId: string; subjectId: string; kind: DocumentKind; key: string; sha256: string; size: number; source: 'gib_live' | 'sahte_gib'; jobId: string }[],
  ): Promise<number>;
}

export type DeclarationSummary = {
  sorgu: number;
  bos: number;
  basarisiz: number;
  erisim_yok: number;
  firma_yok: number;
  beyanname: number;
  yeni: number;
  belge: number;
  belge_uyarisi: number;
};

export async function importDeclarations(
  ctx: Ctx,
  input: { jobId: string; source: 'gib_live' | 'sahte_gib'; contracts: readonly ContractRow[]; queries: readonly DeclarationQuery[] },
  d: { firms: Pick<FirmPort, 'byTaxIds'>; declarations: DeclarationRepository; documents: DocumentPort },
): Promise<DeclarationSummary> {
  const s: DeclarationSummary = { sorgu: input.queries.length, bos: 0, basarisiz: 0, erisim_yok: 0, firma_yok: 0, beyanname: 0, yeni: 0, belge: 0, belge_uyarisi: 0 };
  const firms = new Map((await d.firms.byTaxIds(ctx, [...new Set(input.queries.map((q) => q.identity))])).map((f) => [f.taxId, f]));
  for (const q of input.queries) {
    if (q.outcome === 'no_access') {
      s.erisim_yok++;
      continue;
    }
    if (q.outcome === 'failed') {
      s.basarisiz++;
      continue;
    }
    const c = checkQuery(q, input.contracts);
    if (!c.ok) {
      if (c.reason === 'erisim_kaniti_yok') s.erisim_yok++;
      else s.basarisiz++;
      continue;
    }
    if (c.records.length === 0) {
      s.bos++;
      continue;
    }
    const firm = firms.get(q.identity);
    if (!firm) {
      s.firma_yok++;
      continue;
    }
    for (const r of c.records) {
      const saved = await d.declarations.upsert(ctx, firm.id, r, { contractNumbers: q.access!.contractNumbers, source: input.source, jobId: input.jobId });
      s.beyanname++;
      if (saved.created) s.yeni++;
      s.belge_uyarisi += r.documentWarnings.length;
      if (r.documents.length) {
        s.belge += await d.documents.register(
          ctx,
          r.documents.map((x) => ({ ...x, firmId: firm.id, subjectId: saved.id, source: input.source, jobId: input.jobId })),
        );
      }
    }
  }
  return s;
}

/** Kullanıcıya gösterilen tek satırlık özet (iş durumu). */
export function declarationSummaryText(x: DeclarationSummary, source: 'gib_live' | 'sahte_gib') {
  const parcalar = [`${x.sorgu} sorgu`, `${x.beyanname} beyanname (${x.yeni} yeni)`, `${x.belge} belge`];
  if (x.bos) parcalar.push(`${x.bos} sorguda kayıt yok`);
  if (x.erisim_yok) parcalar.push(`${x.erisim_yok} mükellefte Aracılık ve Sorumluluk sözleşmesi yok`);
  if (x.basarisiz) parcalar.push(`${x.basarisiz} sorgu başarısız`);
  if (x.firma_yok) parcalar.push(`${x.firma_yok} kayıt firmasız`);
  if (x.belge_uyarisi) parcalar.push(`${x.belge_uyarisi} belge alınamadı`);
  if (source === 'sahte_gib') parcalar.push('kaynak: sahte GİB (demo)');
  return parcalar.join(' · ');
}

export const listDeclarations = (ctx: Ctx, filter: DeclarationFilter, d: { declarations: DeclarationRepository }) => d.declarations.list(ctx, filter);
export const getDeclaration = (ctx: Ctx, id: string, d: { declarations: DeclarationRepository }) => d.declarations.get(ctx, id);
export const declarationTypes = (ctx: Ctx, d: { declarations: DeclarationRepository }) => d.declarations.types(ctx);

/** Eski portalın beyanname dışa aktarımı: ekrandaki süzgeçle aynı satırlar. */
export const declarationsCsv = (rows: readonly StoredDeclaration[]) =>
  toCsv(rows, [
    { baslik: 'Mükellef', deger: (r) => r.firmTitle },
    { baslik: 'VKN/TCKN', deger: (r) => r.taxId },
    { baslik: 'Beyanname türü', deger: (r) => r.type },
    { baslik: 'Dönem', deger: (r) => periodLabel(r.periodStart, r.periodEnd) },
    { baslik: 'Yükleme zamanı', deger: (r) => new Date(r.uploadedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) },
    { baslik: 'Tahakkuk durumu', deger: (r) => r.taxStatus },
    { baslik: 'SGK durumu', deger: (r) => r.sgkStatus },
    { baslik: 'Kaynak', deger: (r) => (r.source === 'sahte_gib' ? 'Sahte GİB (demo)' : 'GİB') },
  ]);

export type ControlCell = { types: string[] };
export type ControlRow = { firmId: string; firmTitle: string; taxId: string; cells: Record<string, ControlCell> };

/**
 * e-Beyanname kontrol (eski portal): mükellef × vergilendirme dönemi; hücrede o döneme ait (dönem başlangıcı) beyanname türleri.
 * Kaydı olmayan dönem boş kalır ("kontrol edilmedi / verilmemiş" ayrımı senkron kapsamıyla yapılır).
 */
export function controlMatrix(rows: readonly StoredDeclaration[], months: readonly string[]): ControlRow[] {
  const byFirm = new Map<string, ControlRow>();
  for (const r of rows) {
    const m = r.periodStart.slice(0, 7);
    if (!months.includes(m)) continue;
    const row = byFirm.get(r.firmId) ?? { firmId: r.firmId, firmTitle: r.firmTitle, taxId: r.taxId, cells: {} };
    const cell = (row.cells[m] ??= { types: [] });
    if (!cell.types.includes(r.type)) cell.types.push(r.type);
    byFirm.set(r.firmId, row);
  }
  for (const row of byFirm.values()) for (const c of Object.values(row.cells)) c.types.sort();
  return [...byFirm.values()].sort((a, b) => a.firmTitle.localeCompare(b.firmTitle, 'tr'));
}

/** Son n vergilendirme dönemi (ay), yeniden eskiye: bugünkü aydan bir önceki aydan başlar (beyanlar bir sonraki ay verilir). */
export function recentPeriods(today: string, n = 6): string[] {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}
