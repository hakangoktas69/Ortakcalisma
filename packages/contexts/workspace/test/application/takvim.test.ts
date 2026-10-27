import { describe, expect, it } from 'vitest';
import {
  applyCalendarSources,
  correctEntry,
  ensureCalendarYear,
  listCalendar,
  type CalendarEntry,
  type CalendarRepository,
  type CalendarSource,
  type StoredEntry,
  type YearSources,
} from '../../src/index.ts';

const ctx = { sub: 'u-1', org: 'o-1' };
const sistem = { org: 'o-1' };

function fakes(paket: Record<number, YearSources> = {}) {
  const satirlar = new Map<string, StoredEntry & { year: number }>();
  const repo: CalendarRepository = {
    yearSummary: async (_c, y) => {
      const s = [...satirlar.values()].filter((e) => e.year === y);
      return { total: s.length, gib: s.filter((e) => e.source === 'gib').length };
    },
    replaceYear: async (_c, y, entries, sources) => {
      const yeni = new Set(entries.map((e) => e.key));
      for (const [k, e] of satirlar) if (e.year === y && sources.includes(e.source) && !yeni.has(k)) satirlar.delete(k);
      for (const e of entries) satirlar.set(e.key, { ...e, year: y, correctedDate: satirlar.get(e.key)?.correctedDate ?? null });
      return entries.length;
    },
    list: async (_c, from, to) => [...satirlar.values()].filter((e) => (e.correctedDate ?? e.date) >= from && (e.correctedDate ?? e.date) <= to),
    correct: async (_c, id, date) => {
      const e = satirlar.get(id);
      if (!e) return 'not_found';
      satirlar.set(id, { ...e, correctedDate: date });
      return 'ok';
    },
  };
  return { repo, satirlar, d: { repo, sources: { bundled: (y: number) => paket[y] ?? {} } } };
}

const gib = (records: { id: number; stopdate: string }[]) => ({
  schema: 'eworks.gib.tax-calendar.v1',
  year: 2026,
  checkedAt: '2026-10-26',
  sourceUrl: 'https://gib.gov.tr/vergi-takvimi',
  count: records.length,
  records: records.map((r) => ({ ...r, title: 'KDV Beyannamesi', description: 'Açıklama', periodDescription: 'Eylül 2026 Dönemi', subject: 'Beyan ve Ödeme' })),
});

describe('takvim use-case\'leri', () => {
  it('yıl ilk kez hazır kaynaktan doldurulur; ikinci çağrı yazmaz; GİB verisi yoksa çekme gerekir', async () => {
    const f = fakes({ 2026: { gib: gib([{ id: 1, stopdate: '2026-10-28T00:00:00' }]) } });
    const r = await ensureCalendarYear(sistem, 2026, f.d);
    expect(r.ok && r.value.needsGib).toBe(false);
    expect(r.ok && r.value.written).toBeGreaterThan(20);
    expect(f.satirlar.has('gib:1')).toBe(true);
    expect(await ensureCalendarYear(sistem, 2026, f.d)).toEqual({ ok: true, value: { written: 0, needsGib: false } });
    const y = await ensureCalendarYear(sistem, 2027, f.d);
    expect(y.ok && y.value.needsGib).toBe(true);
    expect([...f.satirlar.values()].some((e) => e.year === 2027 && e.source === 'tatil')).toBe(true);
  });

  it('[F:genel_bakis.takvim.view] aralık listesi düzeltilmiş tarihi kullanır; geçersiz ya da çok uzun aralık reddedilir', async () => {
    const f = fakes();
    await ensureCalendarYear(sistem, 2026, f.d);
    const ekim = await listCalendar(ctx, '2026-10-01', '2026-10-31', f.d);
    expect(ekim.ok && ekim.value.map((e) => e.key)).toEqual(expect.arrayContaining(['tatil:2026-10-28', 'tatil:2026-10-29']));
    expect(ekim.ok && ekim.value.map((e) => e.date)).toEqual(ekim.ok ? [...ekim.value.map((e) => e.date)].sort() : []);
    expect(await listCalendar(ctx, '2026-13-01', '2026-10-31', f.d)).toEqual({ ok: false, error: 'gecersiz_aralik' });
    expect(await listCalendar(ctx, '2026-10-31', '2026-10-01', f.d)).toEqual({ ok: false, error: 'gecersiz_aralik' });
    expect(await listCalendar(ctx, '2025-01-01', '2027-03-01', f.d)).toEqual({ ok: false, error: 'gecersiz_aralik' });
  });

  it('[F:genel_bakis.takvim.edit] yalnız yetkili kullanıcı tarihi düzeltir; düzeltme yeniden içe aktarmada korunur', async () => {
    const f = fakes();
    await ensureCalendarYear(sistem, 2026, f.d);
    const anahtar = 'kural:sgk-prim:2026-09';
    expect(await correctEntry(ctx, anahtar, '2026-11-03', () => false, f.d)).toEqual({ ok: false, error: 'yetki_yok' });
    expect(await correctEntry(ctx, anahtar, '2026-02-30', () => true, f.d)).toEqual({ ok: false, error: 'gecersiz_tarih' });
    expect(await correctEntry(ctx, 'yok', '2026-11-03', () => true, f.d)).toEqual({ ok: false, error: 'bulunamadi' });
    expect(await correctEntry(ctx, anahtar, '2026-11-03', () => true, f.d)).toEqual({ ok: true, value: { id: anahtar } });
    await applyCalendarSources(sistem, 2026, {}, f.d);
    const l = await listCalendar(ctx, '2026-11-01', '2026-11-30', f.d);
    expect(l.ok && l.value.find((e) => e.key === anahtar)).toMatchObject({ date: '2026-11-03', corrected: true, certainty: 'kesin' });
    expect(await correctEntry(ctx, anahtar, null, () => true, f.d)).toEqual({ ok: true, value: { id: anahtar } });
  });

  it('kaynak sonucu fail-closed: doğrulanamayan GİB verisi hiçbir satırı değiştirmez; geçerli kaynak eski kaydı siler', async () => {
    const f = fakes();
    await ensureCalendarYear(sistem, 2026, f.d);
    await applyCalendarSources(sistem, 2026, { gib: gib([{ id: 1, stopdate: '2026-10-28T00:00:00' }, { id: 2, stopdate: '2026-11-26T00:00:00' }]) }, f.d);
    const once = f.satirlar.size;
    expect(await applyCalendarSources(sistem, 2026, { gib: { ...gib([{ id: 3, stopdate: '2026-10-28T00:00:00' }]), count: 9 } }, f.d)).toEqual({ ok: false, error: 'sayi_uyusmuyor' });
    expect(f.satirlar.size).toBe(once);
    const r = await applyCalendarSources(sistem, 2026, { gib: gib([{ id: 2, stopdate: '2026-11-26T00:00:00' }]) }, f.d);
    expect(r.ok).toBe(true);
    expect(f.satirlar.has('gib:1')).toBe(false);
    expect(f.satirlar.has('gib:2')).toBe(true);
    const kaynaklar = new Set<CalendarSource>([...f.satirlar.values()].map((e: CalendarEntry) => e.source));
    expect(kaynaklar).toEqual(new Set(['gib', 'tatil', 'kural']));
  });
});

describe('kaynak eksikken korunan kayıtlar', () => {
  it('bayram kaynağı alınamadıysa (yalnız GİB) mevcut bayramlar ve SGK kural tarihleri silinmez, değişmez', async () => {
    const f = fakes();
    await applyCalendarSources(sistem, 2027, { religious: { dates: { ramazan: '2027-03-10', kurban: '2027-05-16' }, certain: false, sourceUrl: 'https://date.nager.at', checkedAt: '2026-10-27' } }, f.d);
    const once = new Map([...f.satirlar].map(([k, v]) => [k, v.date]));
    expect([...once.keys()].some((k) => k.startsWith('tatil:kurban:'))).toBe(true);
    const r = await applyCalendarSources(sistem, 2027, { gib: { ...gib([{ id: 7, stopdate: '2027-01-28T00:00:00' }]), year: 2027 } }, f.d);
    expect(r.ok).toBe(true);
    for (const [k, tarih] of once) expect(f.satirlar.get(k)?.date, k).toBe(tarih);
    expect(f.satirlar.has('gib:7')).toBe(true);
  });
});
