import { err, ok } from '@eworks/kernel';
import { withCtx, type Client, type ShardRouter } from '@eworks/platform';
import type { Ctx, Reminder, ReminderRepository } from '../application/reminders.ts';
import type { ValidReminder } from '../domain/reminder.ts';

// Kişisel hatırlatma deposu. Sahiplik ve firma kapsamı RLS'te (user_id = app.uid(), can_see_firm); uygulama da org ile süzer.

const KAYIT = `r.id, r.title, to_char(r.remind_on, 'YYYY-MM-DD') as "remindOn", to_char(r.remind_time, 'HH24:MI') as "remindTime", r.category,
  r.firm_id as "firmId", f.title as "firmTitle", r.note, r.remind_days as "remindDays", r.source_entry as "sourceEntry", r.done`;

export class PgReminderRepository implements ReminderRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, fn);
  }
  list(ctx: Ctx, from: string, to: string) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<Reminder>(
          `select ${KAYIT} from workspace.reminders r left join portfolio.firms f on f.org_id = r.org_id and f.id = r.firm_id
            where r.org_id = $1 and r.remind_on between $2::date and $3::date order by r.remind_on, r.remind_time nulls first, r.created_at limit 2000`,
          [ctx.org, from, to],
        )
      ).rows,
    );
  }
  async insert(ctx: Ctx, r: ValidReminder) {
    try {
      const id = await this.tx(ctx, async (c) =>
        (
          await c.query<{ id: string }>(
            `insert into workspace.reminders(org_id, user_id, title, remind_on, remind_time, category, firm_id, note, remind_days, source_entry)
             values ($1, $2, $3, $4::date, $5::time, $6, $7, $8, $9, $10) returning id`,
            [ctx.org, ctx.sub, r.title, r.remindOn, r.remindTime, r.category, r.firmId, r.note, r.remindDays, r.sourceEntry],
          )
        ).rows[0]!.id,
      );
      return ok(id);
    } catch (e) {
      // Firma yok (yabancı anahtar) ya da kullanıcının kapsamında değil (RLS): bilinen durum
      const kod = (e as { code?: string }).code;
      if (r.firmId && (kod === '23503' || kod === '42501')) return err('firma_yok' as const);
      throw e;
    }
  }
  setDone(ctx: Ctx, id: string, done: boolean) {
    return this.tx(ctx, async (c) => ((await c.query('update workspace.reminders set done = $3 where org_id = $1 and id = $2', [ctx.org, id, done])).rowCount ?? 0) > 0);
  }
  remove(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) => ((await c.query('delete from workspace.reminders where org_id = $1 and id = $2', [ctx.org, id])).rowCount ?? 0) > 0);
  }
}
