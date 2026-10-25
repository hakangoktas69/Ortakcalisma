import { groupContracts, type ContractList, type ContractRow, type ListError } from '../domain/contract-list.ts';

// Sözleşme listesini ofise uygular (işçi, sistem bağlamı). Firmalar portfolio bağlamının public API'siyle eşleştirilir/açılır
// (06 §1: bağlamlar birbirine yalnız index.ts ile erişir). Kaynaktan kaybolan firma ya da sözleşme silinmez.

export type Ctx = { readonly sub?: string; readonly org: string };

export type FirmRef = { id: string; taxId: string; title: string; taxOffice: string | null; source: 'manual' | 'gib_contract' };

/** portfolio bağlamına giden port (işçideki bileşim kökü portfolio use-case'lerine bağlar). */
export interface FirmPort {
  byTaxIds(ctx: Ctx, taxIds: readonly string[]): Promise<FirmRef[]>;
  create(ctx: Ctx, s: { title: string; taxId: string; taxOffice: string; advisorId: string }): Promise<{ ok: true; id: string } | { ok: false; error: 'gecersiz' | 'vkn_kayitli' }>;
  refresh(ctx: Ctx, f: FirmRef, s: { title: string; taxOffice: string }): Promise<boolean>;
}

export type StoredContract = {
  id: string;
  firmId: string;
  firmTitle: string;
  taxId: string;
  number: string;
  contractDate: string | null;
  contractType: string | null;
  service: string | null;
  registeredAt: string | null;
  taxOffice: string | null;
  source: 'gib_live' | 'sahte_gib';
  lastSeenAt: string;
};

export interface ContractRepository {
  upsert(ctx: Ctx, firmId: string, rows: readonly ContractRow[], source: 'gib_live' | 'sahte_gib', jobId: string): Promise<void>;
  list(ctx: Ctx): Promise<StoredContract[]>;
}

export type ImportSummary = { sozlesme: number; mukellef: number; yeni: number; eslesen: number; guncellenen: number; cakisan: number; gecersiz: number };

export async function importFilingContracts(
  ctx: Ctx,
  input: { jobId: string; advisorId: string; source: 'gib_live' | 'sahte_gib'; list: ContractList },
  d: { firms: FirmPort; contracts: ContractRepository },
): Promise<{ ok: true; summary: ImportSummary } | { ok: false; error: ListError }> {
  const g = groupContracts(input.list);
  if (!g.ok) return g;
  const mevcut = new Map((await d.firms.byTaxIds(ctx, g.groups.map((x) => x.taxId))).map((f) => [f.taxId, f]));
  const s: ImportSummary = { sozlesme: input.list.count, mukellef: g.groups.length, yeni: 0, eslesen: 0, guncellenen: 0, cakisan: 0, gecersiz: 0 };
  for (const grup of g.groups) {
    let firmId: string;
    const f = mevcut.get(grup.taxId);
    if (f) {
      s.eslesen++;
      if (await d.firms.refresh(ctx, f, { title: grup.name, taxOffice: grup.taxOffice })) s.guncellenen++;
      firmId = f.id;
    } else {
      const r = await d.firms.create(ctx, { title: grup.name, taxId: grup.taxId, taxOffice: grup.taxOffice, advisorId: input.advisorId });
      if (!r.ok) {
        // VKN başka ofiste kayıtlı (tek müşavir kuralı, D16) ya da kimlik kontrol hanesi tutmuyor: mükellef alınmaz, sayılır
        if (r.error === 'vkn_kayitli') s.cakisan++;
        else s.gecersiz++;
        continue;
      }
      s.yeni++;
      firmId = r.id;
    }
    await d.contracts.upsert(ctx, firmId, grup.contracts, input.source, input.jobId);
  }
  return { ok: true, summary: s };
}

export const listFilingContracts = (ctx: Ctx, d: { contracts: ContractRepository }) => d.contracts.list(ctx);
