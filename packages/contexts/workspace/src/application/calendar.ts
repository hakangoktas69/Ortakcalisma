import { err, ok, type Result } from '@eworks/kernel';
import { addDays, buildYear, validDate, type CalendarEntry, type CalendarSource, type GibCalendarError, type YearSources } from '../domain/calendar.ts';

// Takvim use-case'leri. Ortak veri (GİB takvimi, tatiller, kural tarihleri) her ofisin shard'ında kopyadır; yalnız işçi yazar
// (sistem bağlamı). Ofis yöneticisi bir tarihi düzeltebilir (genel_bakis.takvim.edit); düzeltme yeniden içe aktarmada korunur.

export type Ctx = { readonly sub?: string; readonly org: string };
export type StoredEntry = CalendarEntry & { correctedDate: string | null };
/** Ekrandaki kayıt: düzeltilmişse tarih düzeltmedir ve kesin sayılır. */
export type ViewEntry = CalendarEntry & { corrected: boolean; originalDate: string };

export interface CalendarRepository {
  yearSummary(ctx: Ctx, year: number): Promise<{ total: number; gib: number }>;
  /** Yılın verilen kaynaklarındaki kayıtları değiştirir: yeniler eklenir/güncellenir, listede olmayanlar silinir; düzeltmeler korunur. */
  replaceYear(ctx: Ctx, year: number, entries: readonly CalendarEntry[], sources: readonly CalendarSource[]): Promise<number>;
  /** Etkin tarihi (düzeltme ya da kaynak) aralıkta olan kayıtlar. */
  list(ctx: Ctx, from: string, to: string): Promise<StoredEntry[]>;
  correct(ctx: Ctx, id: string, date: string | null): Promise<'ok' | 'not_found'>;
}

/** Depoyla gelen hazır kaynak verisi (doğrulanmış anlık görüntüler). */
export interface CalendarSourcePort {
  bundled(year: number): YearSources;
}

export type CalendarDeps = { repo: CalendarRepository; sources: CalendarSourcePort };
type BuildError = GibCalendarError | 'gecersiz_bayram';

const kaynaklari = (s: YearSources): CalendarSource[] => ['tatil', 'kural', ...(s.gib ? (['gib'] as const) : [])];

/**
 * Yıl hiç yoksa hazır kaynaktan doldurur; GİB verisi yokken hazır kaynakta varsa ekler. `needsGib`: GİB takvimi hâlâ yok,
 * kurumdan çekilmeli (sync işi). İdempotent.
 */
export async function ensureCalendarYear(ctx: Ctx, year: number, d: CalendarDeps): Promise<Result<{ written: number; needsGib: boolean }, BuildError>> {
  const ozet = await d.repo.yearSummary(ctx, year);
  const hazir = d.sources.bundled(year);
  if (ozet.total > 0 && (ozet.gib > 0 || !hazir.gib)) return ok({ written: 0, needsGib: ozet.gib === 0 });
  const y = buildYear(year, hazir);
  if (!y.ok) return y;
  const written = await d.repo.replaceYear(ctx, year, y.value, kaynaklari(hazir));
  return ok({ written, needsGib: !hazir.gib });
}

/**
 * Kurumdan/açık kaynaktan çekilen yıl verisini uygular. Doğrulanamazsa hiçbir satır değişmez (fail-closed). Bayram kaynağı yoksa
 * yalnız GİB kayıtları değişir: mevcut bayramlar ve onlara göre hesaplanmış SGK kural tarihleri korunur (bayramsız yeniden hesap
 * son günü bayrama düşürebilir).
 */
export async function applyCalendarSources(ctx: Ctx, year: number, s: YearSources, d: { repo: Pick<CalendarRepository, 'replaceYear'> }): Promise<Result<{ written: number }, BuildError>> {
  const y = buildYear(year, s);
  if (!y.ok) return y;
  if (s.religious) return ok({ written: await d.repo.replaceYear(ctx, year, y.value, kaynaklari(s)) });
  if (!s.gib) return ok({ written: 0 });
  return ok({ written: await d.repo.replaceYear(ctx, year, y.value.filter((e) => e.source === 'gib'), ['gib']) });
}

const AZAMI_GUN = 400;

export async function listCalendar(ctx: Ctx, from: string, to: string, d: Pick<CalendarDeps, 'repo'>): Promise<Result<ViewEntry[], 'gecersiz_aralik'>> {
  if (!validDate(from) || !validDate(to) || to < from || addDays(from, AZAMI_GUN) < to) return err('gecersiz_aralik');
  const satirlar = await d.repo.list(ctx, from, to);
  return ok(
    satirlar
      .map((e) => {
        const { correctedDate, ...k } = e;
        return correctedDate ? { ...k, date: correctedDate, certainty: 'kesin' as const, corrected: true, originalDate: e.date } : { ...k, corrected: false, originalDate: e.date };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key)),
  );
}

/** Tarih düzeltme (null: düzeltmeyi kaldır). Yetki BFF'te ve veritabanında (yalnız ofis yöneticisi) denetlenir. */
export async function correctEntry(
  ctx: Ctx,
  id: string,
  date: string | null,
  can: (key: string) => boolean,
  d: Pick<CalendarDeps, 'repo'>,
): Promise<Result<{ id: string }, 'yetki_yok' | 'gecersiz_tarih' | 'bulunamadi'>> {
  if (!can('genel_bakis.takvim.edit')) return err('yetki_yok');
  if (date !== null && !validDate(date)) return err('gecersiz_tarih');
  return (await d.repo.correct(ctx, id, date)) === 'ok' ? ok({ id }) : err('bulunamadi');
}
