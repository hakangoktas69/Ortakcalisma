import { withCtx, type ShardRouter } from '@eworks/platform';
import type { ContractRow } from '../domain/contract-list.ts';
import type { ContractRepository, Ctx, StoredContract } from '../application/contracts.ts';

export class PgContractRepository implements ContractRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  async upsert(ctx: Ctx, firmId: string, rows: readonly ContractRow[], source: 'gib_live' | 'sahte_gib', jobId: string) {
    await withCtx(await this.router.poolFor(ctx.org), ctx, async (c) => {
      for (const r of rows) {
        await c.query(
          `insert into tax_filing.filing_contracts(org_id, firm_id, number, contract_date, service, registered_at, contract_type, tax_office, source, last_seen_job)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           on conflict (org_id, firm_id, number) do update set contract_date = excluded.contract_date, service = excluded.service,
             registered_at = excluded.registered_at, contract_type = excluded.contract_type, tax_office = excluded.tax_office,
             source = excluded.source, last_seen_job = excluded.last_seen_job, last_seen_at = now()`,
          [ctx.org, firmId, r.number.trim().slice(0, 100), r.date.slice(0, 40), r.service.slice(0, 200), r.registeredAt.slice(0, 40), r.type.slice(0, 200), r.taxOffice.slice(0, 120), source, jobId],
        );
      }
    });
  }
  async list(ctx: Ctx) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, async (c) =>
      (
        await c.query<StoredContract>(
          `select k.id, k.firm_id as "firmId", f.title as "firmTitle", f.tax_id as "taxId", k.number, k.contract_date as "contractDate",
                  k.contract_type as "contractType", k.service, k.registered_at as "registeredAt", k.tax_office as "taxOffice", k.source, k.last_seen_at as "lastSeenAt"
             from tax_filing.filing_contracts k join portfolio.firms f on f.org_id = k.org_id and f.id = k.firm_id
            where k.org_id = $1 and f.archived_at is null order by f.title collate "tr-TR-x-icu", k.number`,
          [ctx.org],
        )
      ).rows,
    );
  }
}
