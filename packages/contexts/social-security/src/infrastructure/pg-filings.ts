import { withCtx, type Client, type ShardRouter } from '@eworks/platform';
import type { SgkFilingRecord } from '../domain/filing.ts';
import type { Ctx, FilingMeta, FilingRepository, StoredFiling } from '../application/filings.ts';

const KOLON = `s.id, s.firm_id as "firmId", f.title as "firmTitle", f.tax_id as "taxId", s.declaration_id as "declarationId", s.workplace,
  to_char(s.period, 'YYYY-MM') as period, s.status, s.employee_count as "employeeCount", s.source`;
const KAYNAK = 'social_security.workplace_filings s join portfolio.firms f on f.org_id = s.org_id and f.id = s.firm_id';

export class PgFilingRepository implements FilingRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, fn);
  }
  upsert(ctx: Ctx, firmId: string, declarationId: string, r: SgkFilingRecord, m: FilingMeta) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<{ id: string }>(
          `insert into social_security.workplace_filings(org_id, firm_id, declaration_id, source_record_id, workplace, period, status, employee_count, source, last_seen_job)
           values ($1, $2, $3, $4, $5, ($6::text || '-01')::date, $7, $8, $9, $10)
           on conflict (org_id, firm_id, source_record_id) do update set declaration_id = excluded.declaration_id, workplace = excluded.workplace,
             period = excluded.period, status = excluded.status, employee_count = coalesce(excluded.employee_count, social_security.workplace_filings.employee_count),
             source = excluded.source, last_seen_job = excluded.last_seen_job, last_seen_at = now()
           returning id`,
          [ctx.org, firmId, declarationId, r.recordId, r.workplace, r.period, r.status, r.employeeCount, m.source, m.jobId],
        )
      ).rows[0]!,
    );
  }
  list(ctx: Ctx, f: { q?: string | undefined; year?: number | undefined; limit?: number | undefined }) {
    return this.tx(ctx, async (c) => {
      const kosul = ['s.org_id = $1', 'f.archived_at is null'];
      const p: unknown[] = [ctx.org];
      if (f.q?.trim()) {
        p.push(`%${f.q.trim()}%`);
        kosul.push(`(f.title ilike $${p.length} or f.tax_id like $${p.length})`);
      }
      if (f.year) {
        p.push(f.year);
        kosul.push(`extract(year from s.period) = $${p.length}`);
      }
      p.push(Math.min(f.limit ?? 2000, 5000));
      return (
        await c.query<StoredFiling>(`select ${KOLON} from ${KAYNAK} where ${kosul.join(' and ')} order by s.period desc, f.title collate "tr-TR-x-icu", s.workplace limit $${p.length}`, p)
      ).rows;
    });
  }
  get(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) => (await c.query<StoredFiling>(`select ${KOLON} from ${KAYNAK} where s.org_id = $1 and s.id = $2`, [ctx.org, id])).rows[0] ?? null);
  }
}
