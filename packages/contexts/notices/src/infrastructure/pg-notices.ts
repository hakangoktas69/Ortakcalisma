import { withCtx, type Client, type ShardRouter } from '@eworks/platform';
import type { Ctx, NoticeRepository, StoredNotice } from '../application/notices.ts';
import type { ValidNotice } from '../domain/notice.ts';

// e-Tebligat deposu: yazma yalnız işçinin sistem bağlamında (RLS app.is_system), okuma firma kapsamında.
const KAYIT = `n.id, n.firm_id as "firmId", f.title as "firmTitle", n.notice_key as "noticeKey", n.reference, n.document_type as "documentType",
  n.sender, n.department, to_char(n.sent_on, 'YYYY-MM-DD') as "sentOn", to_char(n.delivered_on, 'YYYY-MM-DD') as "deliveredOn",
  to_char(n.read_on, 'YYYY-MM-DD') as "readOn", n.job_id as "jobId"`;

export class PgNoticeRepository implements NoticeRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, fn);
  }
  upsert(ctx: Ctx, firmId: string, rows: readonly ValidNotice[], jobId: string) {
    return this.tx(ctx, async (c) => {
      const r = await c.query<{ yeni: boolean }>(
        `insert into notices.notices(org_id, firm_id, notice_key, reference, document_type, sender, department, sent_on, delivered_on, read_on, job_id)
         select $1, $2, x."noticeKey", x.reference, x."documentType", x.sender, x.department, x."sentOn"::date, x."deliveredOn"::date, x."readOn"::date, $4
           from jsonb_to_recordset($3::jsonb) as x("noticeKey" text, reference text, "documentType" text, sender text, department text, "sentOn" text, "deliveredOn" text, "readOn" text)
         on conflict (org_id, firm_id, notice_key) do update set reference = excluded.reference, document_type = excluded.document_type, sender = excluded.sender,
           department = excluded.department, sent_on = excluded.sent_on, delivered_on = excluded.delivered_on, read_on = excluded.read_on, job_id = excluded.job_id, updated_at = now()
         returning (xmax = 0) as yeni`,
        [ctx.org, firmId, JSON.stringify(rows), jobId],
      );
      const yeni = r.rows.filter((x) => x.yeni).length;
      return { yeni, guncellenen: r.rows.length - yeni };
    });
  }
  list(ctx: Ctx, f: { firmId?: string }) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<StoredNotice>(
          `select ${KAYIT} from notices.notices n left join portfolio.firms f on f.org_id = n.org_id and f.id = n.firm_id
            where n.org_id = $1 and ($2::uuid is null or n.firm_id = $2) order by n.sent_on desc, n.reference limit 2000`,
          [ctx.org, f.firmId ?? null],
        )
      ).rows,
    );
  }
}
