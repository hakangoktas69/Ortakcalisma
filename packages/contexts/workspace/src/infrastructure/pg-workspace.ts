import { withUser, type Client, type ShardRouter } from '@eworks/platform';
import type { TaskInput, TaskStatus } from '../domain/task.ts';
import type { Ctx, Note, NoteRepository, Task, TaskRepository } from '../application/workspace.ts';

const GOREV = `t.id, t.title, t.firm_id as "firmId", f.title as "firmTitle", to_char(t.due_on, 'YYYY-MM-DD') as "dueOn", t.status,
  t.assignee_id as "assigneeId", t.created_by as "createdBy", t.created_at as "createdAt", t.version`;

abstract class Pg {
  protected readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  protected async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withUser(await this.router.poolFor(ctx.org), { sub: ctx.sub, org: ctx.org }, fn);
  }
}

export class PgTaskRepository extends Pg implements TaskRepository {
  list(ctx: Ctx) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<Task>(
          `select ${GOREV} from workspace.tasks t left join portfolio.firms f on f.org_id = t.org_id and f.id = t.firm_id
            where t.org_id = $1 order by (t.status = 'Tamamlandı'), t.due_on, t.created_at limit 2000`,
          [ctx.org],
        )
      ).rows,
    );
  }
  get(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) =>
      (await c.query<Task>(`select ${GOREV} from workspace.tasks t left join portfolio.firms f on f.org_id = t.org_id and f.id = t.firm_id where t.org_id = $1 and t.id = $2`, [ctx.org, id])).rows[0] ??
      null,
    );
  }
  insert(ctx: Ctx, t: TaskInput) {
    return this.tx(ctx, async (c) => {
      const id = (
        await c.query<{ id: string }>(
          'insert into workspace.tasks(org_id, title, firm_id, due_on, assignee_id, created_by) values ($1, $2, $3, $4, $5, $6) returning id',
          [ctx.org, t.title, t.firmId, t.dueOn, t.assigneeId, ctx.sub],
        )
      ).rows[0]!.id;
      if (t.assigneeId && t.assigneeId !== ctx.sub) await c.query(`select audit.record($1, 'gorev.atandi', $2, jsonb_build_object('sorumlu', $3::text))`, [ctx.org, id, t.assigneeId]);
      return id;
    });
  }
  update(ctx: Ctx, id: string, version: number, p: { status?: TaskStatus; assigneeId?: string | null }) {
    return this.tx(ctx, async (c) => {
      const r = await c.query(
        `update workspace.tasks set status = coalesce($4, status),
            assignee_id = case when $5 then $6::uuid else assignee_id end,
            closed_at = case when coalesce($4, status) = 'Tamamlandı' then coalesce(closed_at, now()) else null end,
            updated_at = now(), version = version + 1
          where org_id = $1 and id = $2 and version = $3`,
        [ctx.org, id, version, p.status ?? null, 'assigneeId' in p, p.assigneeId ?? null],
      );
      if (r.rowCount === 1) {
        if (p.status === 'Tamamlandı') await c.query(`select audit.record($1, 'gorev.kapatildi', $2, '{}'::jsonb)`, [ctx.org, id]);
        if ('assigneeId' in p) await c.query(`select audit.record($1, 'gorev.atandi', $2, jsonb_build_object('sorumlu', $3::text))`, [ctx.org, id, p.assigneeId]);
        return 'ok' as const;
      }
      // Görünür ama güncellenemiyorsa (sürüm) çatışma; görünmüyorsa ya da yetki dışıysa bulunamadı
      const mevcut = await c.query<{ version: number }>('select version from workspace.tasks where org_id = $1 and id = $2', [ctx.org, id]);
      return mevcut.rows[0] && mevcut.rows[0].version !== version ? ('catisma' as const) : ('bulunamadi' as const);
    });
  }
}

export class PgNoteRepository extends Pg implements NoteRepository {
  list(ctx: Ctx, firmId?: string) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<Note>(
          `select n.id, n.firm_id as "firmId", f.title as "firmTitle", n.body, n.author_id as "authorId", n.created_at as "createdAt"
             from workspace.notes n join portfolio.firms f on f.org_id = n.org_id and f.id = n.firm_id
            where n.org_id = $1 and ($2::uuid is null or n.firm_id = $2) order by n.created_at desc limit 500`,
          [ctx.org, firmId ?? null],
        )
      ).rows,
    );
  }
  insert(ctx: Ctx, firmId: string, body: string) {
    return this.tx(ctx, async (c) =>
      (await c.query<{ id: string }>('insert into workspace.notes(org_id, firm_id, body, author_id) values ($1, $2, $3, $4) returning id', [ctx.org, firmId, body, ctx.sub])).rows[0]!.id,
    );
  }
}
