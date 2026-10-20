import { describe, expect, it } from 'vitest';
import { DECLARATION_INFO, DECLARATION_ORDER, DEFAULT_OBLIGATIONS, expectedForMonth, parseControlMonth, periodLabel, statusOf } from './declaration-rules.js';

// Çekirdek kural: beklenen beyannameler, yasal son günler ve durumlar.

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const due = (year: number, month: number, type: string) => expectedForMonth(year, month).find((e) => e.type === type)?.dueDate;

describe('expectedForMonth', () => {
  it('aylık beyannameler: KDV izleyen ayın 28\'i, MUHSGK ve Damga 26\'sı, gün sonu', () => {
    const e = expectedForMonth(2026, 9);
    expect(e.map((x) => x.type)).toEqual(['KDV1', 'MUHSGK', 'DAMGA', 'GECICI_VERGI']);
    expect(ymd(due(2026, 9, 'KDV1')!)).toBe('2026-10-28');
    expect(ymd(due(2026, 9, 'MUHSGK')!)).toBe('2026-10-26');
    expect(due(2026, 9, 'KDV1')!.getHours()).toBe(23);
    expect(e.every((x) => x.period === '2026-09' || x.period === '2026-Q3')).toBe(true);
  });

  it('hafta sonuna denk gelen son gün ilk iş gününe kayar', () => {
    // 28 Kasım 2026 Cumartesi → 30 Kasım Pazartesi
    expect(ymd(due(2026, 10, 'KDV1')!)).toBe('2026-11-30');
    for (let m = 1; m <= 12; m++) for (const e of expectedForMonth(2027, m)) expect([0, 6]).not.toContain(e.dueDate.getDay());
  });

  it('geçici vergi yalnız Mart/Haziran/Eylül\'de, çeyrek sonunu izleyen 2. ayın 17\'si; 4. dönem yok', () => {
    expect(expectedForMonth(2026, 3).find((e) => e.type === 'GECICI_VERGI')).toMatchObject({ period: '2026-Q1' });
    expect(ymd(due(2026, 3, 'GECICI_VERGI')!)).toBe('2026-05-18'); // 17 Mayıs Pazar → Pazartesi
    expect(due(2026, 12, 'GECICI_VERGI')).toBeUndefined();
    expect(due(2026, 4, 'GECICI_VERGI')).toBeUndefined();
  });

  it('yıllık beyannameler Aralık kontrolünde: gelir Mart sonu, kurumlar Nisan sonu (ertesi yıl)', () => {
    const e = expectedForMonth(2026, 12);
    expect(e.find((x) => x.type === 'YILLIK_GELIR')).toMatchObject({ period: '2026' });
    expect(ymd(due(2026, 12, 'YILLIK_GELIR')!)).toBe('2027-03-31');
    expect(ymd(due(2026, 12, 'KURUMLAR')!)).toBe('2027-04-30');
    expect(due(2026, 11, 'KURUMLAR')).toBeUndefined();
  });

  it('Aralık dönemi KDV\'si ertesi yılın Ocak ayına düşer', () => {
    expect(ymd(due(2026, 12, 'KDV1')!)).toBe('2027-01-28');
  });
});

describe('statusOf', () => {
  const d = new Date(2026, 9, 28, 23, 59, 59);
  it.each([
    [new Date(2026, 9, 27), undefined, 'FILED'],
    [new Date(2026, 9, 29), undefined, 'FILED_LATE'],
    [null, new Date(2026, 9, 20), 'PENDING'],
    [null, new Date(2026, 9, 29), 'LATE'],
  ] as const)('verildi=%s şimdi=%s → %s', (filedAt, now, expected) => {
    expect(statusOf(d, filedAt, now ?? new Date(2026, 10, 1))).toBe(expected);
  });
});

describe('parseControlMonth', () => {
  it('geçerli ay değeri olduğu gibi; geçersiz/boşsa önceki ay (yılbaşında bir önceki yıl)', () => {
    expect(parseControlMonth('2026-09')).toEqual({ year: 2026, month: 9 });
    expect(parseControlMonth('2026-13', new Date(2026, 9, 20))).toEqual({ year: 2026, month: 9 });
    expect(parseControlMonth(undefined, new Date(2026, 0, 15))).toEqual({ year: 2025, month: 12 });
    expect(parseControlMonth('bozuk', new Date(2026, 9, 20))).toEqual({ year: 2026, month: 9 });
  });
});

describe('periodLabel ve sabitler', () => {
  it('dönem etiketleri', () => {
    expect(periodLabel('2026-09')).toBe('Eylül 2026');
    expect(periodLabel('2026-Q3')).toBe('2026 / 3. dönem');
    expect(periodLabel('2026')).toBe('2026');
  });

  it('her tür için bilgi ve sıra tanımlı; varsayılan yükümlülükler türle tutarlı', () => {
    expect(Object.keys(DECLARATION_INFO).sort()).toEqual([...DECLARATION_ORDER].sort());
    expect(DEFAULT_OBLIGATIONS.SIRKET).toContain('KURUMLAR');
    expect(DEFAULT_OBLIGATIONS.SAHIS).toContain('YILLIK_GELIR');
    expect(DEFAULT_OBLIGATIONS.SAHIS).not.toContain('KURUMLAR');
    expect(DEFAULT_OBLIGATIONS.BASIT_USUL).not.toContain('KDV1'); // basit usul KDV mükellefi değildir
  });
});
