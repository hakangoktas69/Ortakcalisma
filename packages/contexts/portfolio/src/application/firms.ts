import { toCsv, type Result } from '@eworks/kernel';
import { inSegment, validateFirm, type FirmFieldError, type FirmInput, type FirmKind, type FirmStatus, type Segment, type TaxRegime, type ValidFirm } from '../domain/firm.ts';

// Firma use-case'leri. Yetki anahtarı BFF'te denetlenir (firmalar.*); görünürlük ve yazma sınırı RLS'tedir (app.can_see_firm).
// VKN tekilliği iki aşamalı (07 §2.2): kontrol düzleminde rezervasyon → shard'da kayıt → rezervasyon onayı.

export type Ctx = { readonly sub: string; readonly org: string };

export type Firm = ValidFirm & {
  id: string;
  advisorId: string;
  advisorName: string;
  source: 'manual' | 'gib_contract';
  archivedAt: string | null;
  version: number;
  updatedAt: string;
};

export type FirmFilter = { q?: string; status?: string; kind?: string; segment?: Segment; includeArchived?: boolean };

export interface FirmRepository {
  list(ctx: Ctx, includeArchived: boolean): Promise<Firm[]>;
  get(ctx: Ctx, id: string): Promise<Firm | null>;
  myAdvisor(ctx: Ctx): Promise<string | null>;
  insert(ctx: Ctx, id: string, advisorId: string, f: ValidFirm): Promise<void>;
  update(ctx: Ctx, id: string, version: number, f: ValidFirm): Promise<'ok' | 'conflict' | 'not_found'>;
  archive(ctx: Ctx, id: string): Promise<boolean>;
  /** Dışa aktarmayı denetim kaydına yazar (ticari gizli veri, security: dışa aktarma kaydı). */
  recordExport(ctx: Ctx, count: number): Promise<void>;
}

export interface TaxpayerRegistry {
  /** 'ok' rezerve edildi (ya da bu ofisin kendi kaydı); 'taken' başka bir ofiste ya da bu ofiste başka firmada aktif. */
  reserve(hash: string, orgId: string, firmId: string): Promise<'ok' | 'taken'>;
  activate(hash: string, orgId: string, firmId: string): Promise<void>;
  release(hash: string, orgId: string, firmId: string): Promise<void>;
}

export type FirmDeps = { repo: FirmRepository; registry: TaxpayerRegistry; hashTaxId: (taxId: string) => string; newId: () => string };

export type FirmError = { kind: 'gecersiz'; errors: FirmFieldError[] } | { kind: 'vkn_kayitli' } | { kind: 'musavir_yok' } | { kind: 'bulunamadi' } | { kind: 'catisma' };

const kucuk = (s: string) => s.toLocaleLowerCase('tr-TR');

export async function listFirms(ctx: Ctx, filter: FirmFilter, d: Pick<FirmDeps, 'repo'>): Promise<Firm[]> {
  const q = kucuk(filter.q?.trim() ?? '');
  return (await d.repo.list(ctx, filter.includeArchived ?? false)).filter(
    (f) =>
      (!filter.status || f.status === filter.status) &&
      (!filter.kind || f.kind === filter.kind) &&
      inSegment(f, filter.segment ?? 'all') &&
      (!q || [f.title, f.taxId, f.taxOffice, f.city, f.representative, f.groupName, f.activityName].some((v) => v && kucuk(v).includes(q))),
  );
}

export const getFirm = (ctx: Ctx, id: string, d: Pick<FirmDeps, 'repo'>) => d.repo.get(ctx, id);

/** Oturumdaki kullanıcının müşavir kaydı (müşavir kurum hesabı ve varsayılan portföy için). */
export const myAdvisorId = (ctx: Ctx, d: Pick<FirmDeps, 'repo'>) => d.repo.myAdvisor(ctx);

export async function createFirm(ctx: Ctx, input: FirmInput & { advisorId?: string }, d: FirmDeps): Promise<Result<{ id: string }, FirmError['kind']> & { errors?: FirmFieldError[] }> {
  const v = validateFirm(input);
  if (!v.ok) return { ok: false, error: 'gecersiz', errors: v.errors };
  const advisorId = input.advisorId || (await d.repo.myAdvisor(ctx));
  if (!advisorId) return { ok: false, error: 'musavir_yok' };
  const id = d.newId();
  const hash = d.hashTaxId(v.value.taxId);
  if ((await d.registry.reserve(hash, ctx.org, id)) === 'taken') return { ok: false, error: 'vkn_kayitli' };
  try {
    await d.repo.insert(ctx, id, advisorId, v.value);
  } catch (err) {
    await d.registry.release(hash, ctx.org, id);
    throw err;
  }
  await d.registry.activate(hash, ctx.org, id);
  return { ok: true, value: { id } };
}

export async function updateFirm(ctx: Ctx, id: string, version: number, input: FirmInput, d: FirmDeps): Promise<Result<{ id: string }, FirmError['kind']> & { errors?: FirmFieldError[] }> {
  const v = validateFirm(input);
  if (!v.ok) return { ok: false, error: 'gecersiz', errors: v.errors };
  const eski = await d.repo.get(ctx, id);
  if (!eski || eski.archivedAt) return { ok: false, error: 'bulunamadi' };
  const yeniHash = d.hashTaxId(v.value.taxId);
  const degisti = eski.taxId !== v.value.taxId;
  if (degisti && (await d.registry.reserve(yeniHash, ctx.org, id)) === 'taken') return { ok: false, error: 'vkn_kayitli' };
  const r = await d.repo.update(ctx, id, version, v.value);
  if (r !== 'ok') {
    if (degisti) await d.registry.release(yeniHash, ctx.org, id);
    return { ok: false, error: r === 'conflict' ? 'catisma' : 'bulunamadi' };
  }
  if (degisti) {
    await d.registry.activate(yeniHash, ctx.org, id);
    await d.registry.release(d.hashTaxId(eski.taxId), ctx.org, id);
  }
  return { ok: true, value: { id } };
}

/** Arşivleme veriyi silmez (10 yıl saklama, D23); VKN sistem genelinde serbest kalır. */
export async function archiveFirm(ctx: Ctx, id: string, d: FirmDeps): Promise<Result<{ id: string }, 'bulunamadi'>> {
  const f = await d.repo.get(ctx, id);
  if (!f || f.archivedAt || !(await d.repo.archive(ctx, id))) return { ok: false, error: 'bulunamadi' };
  await d.registry.release(d.hashTaxId(f.taxId), ctx.org, id);
  return { ok: true, value: { id } };
}

/** Eski portalın "Excel / CSV" dışa aktarımı (firmalar.liste.export): ekrandaki süzgeçle aynı satırlar, denetim kaydıyla. */
export async function exportFirms(ctx: Ctx, filter: FirmFilter, d: Pick<FirmDeps, 'repo'>): Promise<string> {
  const firms = await listFirms(ctx, filter, d);
  await d.repo.recordExport(ctx, firms.length);
  return firmsCsv(firms);
}

export const firmsCsv = (firms: readonly Firm[]) =>
  toCsv(firms, [
    { baslik: 'Unvan', deger: (f) => f.title },
    { baslik: 'Tür', deger: (f) => f.kind },
    { baslik: 'VKN/TCKN', deger: (f) => f.taxId },
    { baslik: 'Vergi dairesi', deger: (f) => f.taxOffice },
    { baslik: 'İl', deger: (f) => f.city },
    { baslik: 'Yetkili', deger: (f) => f.representative },
    { baslik: 'Telefon', deger: (f) => f.phone },
    { baslik: 'E-posta', deger: (f) => f.email },
    { baslik: 'Faaliyet kodu', deger: (f) => f.activityCode },
    { baslik: 'Faaliyet', deger: (f) => f.activityName },
    { baslik: 'Vergilendirme', deger: (f) => f.taxRegime },
    { baslik: 'Onay durumu', deger: (f) => f.status },
    { baslik: 'Grup', deger: (f) => f.groupName },
    { baslik: 'Müşavir', deger: (f) => f.advisorName },
  ]);

export type { FirmInput, FirmKind, FirmStatus, Segment, TaxRegime };
