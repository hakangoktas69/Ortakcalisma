import { readFileSync } from 'node:fs';
import { withCtx, type Client, type ShardRouter } from '@eworks/platform';
import type { CalendarRepository, CalendarSourcePort, Ctx, StoredEntry } from '../application/calendar.ts';
import type { CalendarEntry, CalendarSource, GibCalendarSnapshot, YearSources } from '../domain/calendar.ts';

// Takvim deposu. Yazma yalnız işçinin sistem bağlamında (RLS: app.is_system); okuma ofis personeli. Düzeltme tanımlayıcı
// fonksiyonla (yalnız ofis yöneticisi, denetim kaydı aynı işlemde).

const KAYIT = `id as key, to_char(entry_date, 'YYYY-MM-DD') as date, title, description, category, source, certainty, half_day as "halfDay", period,
  source_url as "sourceUrl", to_char(checked_at, 'YYYY-MM-DD') as "checkedAt", reference, to_char(corrected_date, 'YYYY-MM-DD') as "correctedDate"`;

export class PgCalendarRepository implements CalendarRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, fn);
  }
  yearSummary(ctx: Ctx, year: number) {
    return this.tx(ctx, async (c) => {
      const r = await c.query<{ total: number; gib: number }>(
        `select count(*)::int as total, count(*) filter (where source = 'gib')::int as gib from workspace.calendar_entries where org_id = $1 and year = $2`,
        [ctx.org, year],
      );
      return r.rows[0] ?? { total: 0, gib: 0 };
    });
  }
  /** Tek işlemde: verilen kaynakların yeni kayıtları eklenir/güncellenir (düzeltme sütunlarına dokunulmaz), eskileri silinir. */
  replaceYear(ctx: Ctx, year: number, entries: readonly CalendarEntry[], sources: readonly CalendarSource[]) {
    return this.tx(ctx, async (c) => {
      await c.query(
        `insert into workspace.calendar_entries(org_id, id, year, entry_date, title, description, category, source, certainty, half_day, period, source_url, checked_at, reference)
         select $1, e.key, $2, e.date::date, e.title, e.description, e.category, e.source, e.certainty, e."halfDay", e.period, e."sourceUrl", e."checkedAt"::date, e.reference
           from jsonb_to_recordset($3::jsonb) as e(key text, date text, title text, description text, category text, source text, certainty text, "halfDay" boolean,
                period text, "sourceUrl" text, "checkedAt" text, reference text)
         on conflict (org_id, id) do update set year = excluded.year, entry_date = excluded.entry_date, title = excluded.title, description = excluded.description,
           category = excluded.category, source = excluded.source, certainty = excluded.certainty, half_day = excluded.half_day, period = excluded.period,
           source_url = excluded.source_url, checked_at = excluded.checked_at, reference = excluded.reference, updated_at = now()`,
        [ctx.org, year, JSON.stringify(entries)],
      );
      await c.query(`delete from workspace.calendar_entries where org_id = $1 and year = $2 and source = any($3::text[]) and not (id = any($4::text[]))`, [
        ctx.org,
        year,
        sources,
        entries.map((e) => e.key),
      ]);
      return entries.length;
    });
  }
  list(ctx: Ctx, from: string, to: string) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<StoredEntry>(
          `select ${KAYIT} from workspace.calendar_entries where org_id = $1 and coalesce(corrected_date, entry_date) between $2::date and $3::date
            order by coalesce(corrected_date, entry_date), id limit 5000`,
          [ctx.org, from, to],
        )
      ).rows,
    );
  }
  correct(ctx: Ctx, id: string, date: string | null) {
    return this.tx(ctx, async (c) => {
      const r = await c.query<{ ok: boolean }>('select workspace.correct_calendar_entry($1, $2, $3::date) as ok', [ctx.org, id, date]);
      return r.rows[0]?.ok ? ('ok' as const) : ('not_found' as const);
    });
  }
}

type DiniBayram = { ramazan: string; kurban: string; certain: boolean; sourceUrl: string | null; checkedAt: string | null };
// Dosyalar çalışırken değişmez: bir kez okunur (işçi her döngüde her ofis × yıl için sorar)
const onbellek = new Map<string, unknown>();
const oku = (ad: string) => {
  if (!onbellek.has(ad)) onbellek.set(ad, JSON.parse(readFileSync(new URL(`./takvim/${ad}`, import.meta.url), 'utf8')));
  return onbellek.get(ad);
};

/** Depoyla gelen doğrulanmış anlık görüntüler: GİB 2026 vergi takvimi (Mert, 26.10.2026) ve Diyanet'le doğrulanmış bayramlar. */
export class BundledCalendarSources implements CalendarSourcePort {
  bundled(year: number): YearSources {
    const out: { -readonly [K in keyof YearSources]: YearSources[K] } = {};
    if (year === 2026) out.gib = oku('gib-vergi-takvimi-2026.json') as GibCalendarSnapshot;
    const bayram = (oku('dini-bayramlar.json') as { yillar: Record<string, DiniBayram> }).yillar[String(year)];
    if (bayram) out.religious = { dates: { ramazan: bayram.ramazan, kurban: bayram.kurban }, certain: bayram.certain, sourceUrl: bayram.sourceUrl, checkedAt: bayram.checkedAt };
    return out;
  }
}
