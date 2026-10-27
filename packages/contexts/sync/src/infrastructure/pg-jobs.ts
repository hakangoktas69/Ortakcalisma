import { withCtx, type Client, type ShardRouter } from '@eworks/platform';
import type { JobKind, JobStatus } from '../domain/job.ts';
import type { Ctx, Job, JobRepository } from '../application/jobs.ts';

const KOLON = `id, kind, account_id as "accountId", status, status_message as "statusMessage", result_summary as "resultSummary",
  created_at as "createdAt", started_at as "startedAt", finished_at as "finishedAt"`;

/** Kuyruk konusu: robot.gib (Python ACL tüketir). Takvim kaynakları da (kamuya açık GİB vergi takvimi) aynı kuyruktan. */
const konu = (kind: JobKind) => (kind === 'takvim.kaynaklar' ? 'robot.gib' : `robot.${kind.split('.')[0]}`);

export class PgJobRepository implements JobRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, fn);
  }
  activeFor(ctx: Ctx, kind: JobKind, accountId: string | null, params?: Record<string, string | number>) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<Job>(
          `select ${KOLON} from sync.jobs where org_id = $1 and kind = $2 and account_id is not distinct from $3::uuid and status in ('queued', 'running')
             and ($4::jsonb is null or params @> $4::jsonb) order by created_at desc limit 1`,
          [ctx.org, kind, accountId, params ?? null],
        )
      ).rows[0] ?? null,
    );
  }
  countSince(ctx: Ctx, kind: JobKind, sinceIso: string, params: Record<string, string | number>) {
    return this.tx(ctx, async (c) =>
      Number(
        (await c.query<{ n: number }>(`select count(*)::int as n from sync.jobs where org_id = $1 and kind = $2 and created_at > $3::timestamptz and params @> $4::jsonb`, [ctx.org, kind, sinceIso, params]))
          .rows[0]?.n ?? 0,
      ),
    );
  }
  async insertWithOutbox(ctx: Ctx, j: { id: string; kind: JobKind; accountId: string | null; requestedBy: string | null; params: Record<string, unknown> }) {
    await this.tx(ctx, async (c) => {
      await c.query('insert into sync.jobs(org_id, id, kind, account_id, requested_by, params) values ($1, $2, $3, $4, $5, $6)', [ctx.org, j.id, j.kind, j.accountId, j.requestedBy, j.params]);
      await c.query('insert into sync.outbox(org_id, topic, payload) values ($1, $2, $3)', [ctx.org, konu(j.kind), { orgId: ctx.org, jobId: j.id, kind: j.kind }]);
    });
  }
  get(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) => (await c.query<Job>(`select ${KOLON} from sync.jobs where org_id = $1 and id = $2`, [ctx.org, id])).rows[0] ?? null);
  }
  latest(ctx: Ctx, kind: JobKind, limit: number) {
    return this.tx(ctx, async (c) => (await c.query<Job>(`select ${KOLON} from sync.jobs where org_id = $1 and kind = $2 order by created_at desc limit $3`, [ctx.org, kind, limit])).rows);
  }
  setStatus(ctx: Ctx, id: string, from: JobStatus[], to: JobStatus, message: string | null, summary?: Record<string, unknown>) {
    return this.tx(ctx, async (c) =>
      (
        await c.query(
          `update sync.jobs set status = $4, status_message = $5, result_summary = coalesce($6, result_summary),
             finished_at = case when $4 in ('succeeded', 'failed', 'wrong_password', 'cancelled') then now() else finished_at end
           where org_id = $1 and id = $2 and status = any($3)`,
          [ctx.org, id, from, to, message, summary ?? null],
        )
      ).rowCount === 1,
    );
  }
  async setMessage(ctx: Ctx, id: string, message: string) {
    await this.tx(ctx, (c) => c.query(`update sync.jobs set status_message = $3, last_progress_at = now() where org_id = $1 and id = $2 and status in ('queued', 'running')`, [ctx.org, id, message]));
  }
  accountOwner(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<{ accountId: string; ownerKind: 'advisor' | 'firm'; ownerId: string }>(
          `select a.id as "accountId", a.owner_kind as "ownerKind", a.owner_id as "ownerId" from sync.jobs j
             join credentials.institution_accounts a on a.org_id = j.org_id and a.id = j.account_id where j.org_id = $1 and j.id = $2`,
          [ctx.org, id],
        )
      ).rows[0] ?? null,
    );
  }
  staleRunning(ctx: Ctx, olderThanMinutes: number) {
    return this.tx(ctx, async (c) =>
      (await c.query<{ id: string }>(`select id from sync.jobs where org_id = $1 and status = 'running' and coalesce(last_progress_at, started_at) < now() - make_interval(mins => $2)`, [ctx.org, olderThanMinutes])).rows.map((r) => r.id),
    );
  }
}
