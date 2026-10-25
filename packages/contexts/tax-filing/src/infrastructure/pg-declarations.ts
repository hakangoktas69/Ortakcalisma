import { withCtx, type Client, type ShardRouter } from '@eworks/platform';
import type { DeclarationRecord } from '../domain/declaration.ts';
import type { DeclarationFilter, DeclarationMeta, DeclarationRepository, StoredDeclaration } from '../application/declarations.ts';
import type { Ctx } from '../application/contracts.ts';

const KOLON = `b.id, b.firm_id as "firmId", f.title as "firmTitle", f.tax_id as "taxId", b.declaration_type as type,
  to_char(b.period_start, 'YYYY-MM') as "periodStart", to_char(b.period_end, 'YYYY-MM') as "periodEnd", b.uploaded_at as "uploadedAt",
  b.tax_status as "taxStatus", b.sgk_status as "sgkStatus", b.source`;

export class PgDeclarationRepository implements DeclarationRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, fn);
  }
  upsert(ctx: Ctx, firmId: string, r: DeclarationRecord, m: DeclarationMeta) {
    return this.tx(ctx, async (c) => {
      const { rows } = await c.query<{ id: string; created: boolean }>(
        `insert into tax_filing.declarations(org_id, firm_id, source_record_id, declaration_type, period_start, period_end, uploaded_at,
            tax_status, sgk_status, branch, reference, reference_type, contract_numbers, source, last_seen_job)
         values ($1, $2, $3, $4, ($5::text || '-01')::date, ($6::text || '-01')::date, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         on conflict (org_id, firm_id, source_record_id) do update set declaration_type = excluded.declaration_type,
           period_start = excluded.period_start, period_end = excluded.period_end, uploaded_at = excluded.uploaded_at,
           tax_status = excluded.tax_status, sgk_status = excluded.sgk_status, branch = excluded.branch, reference = excluded.reference,
           reference_type = excluded.reference_type, contract_numbers = excluded.contract_numbers, source = excluded.source,
           last_seen_job = excluded.last_seen_job, last_seen_at = now()
         returning id, (xmax = 0) as created`,
        [ctx.org, firmId, r.recordId, r.type, r.periodStart, r.periodEnd, r.uploadedAt, r.taxStatus.slice(0, 200), r.sgkStatus.slice(0, 200),
          r.branch.slice(0, 20), r.reference.slice(0, 200), r.referenceType, m.contractNumbers.slice(0, 20), m.source, m.jobId],
      );
      return rows[0]!;
    });
  }
  list(ctx: Ctx, f: DeclarationFilter) {
    return this.tx(ctx, async (c) => {
      const kosul = ['b.org_id = $1', 'f.archived_at is null'];
      const p: unknown[] = [ctx.org];
      if (f.q?.trim()) {
        p.push(`%${f.q.trim()}%`);
        kosul.push(`(f.title ilike $${p.length} or f.tax_id like $${p.length})`);
      }
      if (f.type) {
        p.push(f.type);
        kosul.push(`b.declaration_type = $${p.length}`);
      }
      if (f.year) {
        p.push(f.year);
        kosul.push(`extract(year from b.period_start) = $${p.length}`);
      }
      if (f.firmId) {
        p.push(f.firmId);
        kosul.push(`b.firm_id = $${p.length}`);
      }
      p.push(Math.min(f.limit ?? 2000, 5000));
      return (
        await c.query<StoredDeclaration>(
          `select ${KOLON} from tax_filing.declarations b join portfolio.firms f on f.org_id = b.org_id and f.id = b.firm_id
            where ${kosul.join(' and ')} order by b.period_start desc, f.title collate "tr-TR-x-icu", b.declaration_type limit $${p.length}`,
          p,
        )
      ).rows.map((r) => ({ ...r, uploadedAt: new Date(r.uploadedAt).toISOString() }));
    });
  }
  get(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) => {
      const r = (
        await c.query<StoredDeclaration>(
          `select ${KOLON} from tax_filing.declarations b join portfolio.firms f on f.org_id = b.org_id and f.id = b.firm_id where b.org_id = $1 and b.id = $2`,
          [ctx.org, id],
        )
      ).rows[0];
      return r ? { ...r, uploadedAt: new Date(r.uploadedAt).toISOString() } : null;
    });
  }
  types(ctx: Ctx) {
    return this.tx(ctx, async (c) =>
      (await c.query<{ t: string }>('select distinct declaration_type as t from tax_filing.declarations where org_id = $1 order by 1', [ctx.org])).rows.map((r) => r.t),
    );
  }
}
