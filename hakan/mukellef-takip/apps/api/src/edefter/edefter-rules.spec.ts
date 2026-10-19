import { describe, expect, it } from 'vitest';
import { eDefterPeriodLabel, periodForMonth, ruleDueDate } from './edefter-rules.js';

describe('ruleDueDate', () => {
  it('aylık: izleyen 4. ayın 14ü (kurumlar) / 10u (gelir) — GİB 2026 tarihleriyle', () => {
    // Ocak 2026 → 14 Mayıs 2026 (Perşembe) ve 10 Mayıs 2026 (Pazar → 11 Mayıs Pazartesi)
    expect(ruleDueDate('2026-01', 'SIRKET')).toEqual(new Date(2026, 4, 14, 23, 59, 59));
    expect(ruleDueDate('2026-01', 'SAHIS')).toEqual(new Date(2026, 4, 11, 23, 59, 59));
  });

  it('aylık: Şubat 2026 → Haziran (14 Haziran Pazar → 15 Haziran)', () => {
    expect(ruleDueDate('2026-02', 'SIRKET')).toEqual(new Date(2026, 5, 15, 23, 59, 59));
    expect(ruleDueDate('2026-02', 'BASIT_USUL')).toEqual(new Date(2026, 5, 10, 23, 59, 59));
  });

  it('aylık: Eylül → Ocak (yıl geçişi)', () => {
    expect(ruleDueDate('2026-09', 'SIRKET')).toEqual(new Date(2027, 0, 14, 23, 59, 59));
  });

  it('Ekim–Aralık ve 4. dönem için tarih üretmez (elle girilmeli)', () => {
    expect(ruleDueDate('2026-10', 'SIRKET')).toBeNull();
    expect(ruleDueDate('2026-12', 'SAHIS')).toBeNull();
    expect(ruleDueDate('2026-Q4', 'SIRKET')).toBeNull();
  });

  it('geçici vergi dönemi: son ayı izleyen 2. ay', () => {
    expect(ruleDueDate('2026-Q1', 'SIRKET')).toEqual(new Date(2026, 4, 14, 23, 59, 59)); // Mayıs
    expect(ruleDueDate('2026-Q3', 'SAHIS')).toEqual(new Date(2026, 10, 10, 23, 59, 59)); // Kasım
  });
});

describe('periodForMonth', () => {
  it('aylıkta her ay, dönemselde sadece çeyrek sonu', () => {
    expect(periodForMonth(2026, 2, 'MONTHLY')).toBe('2026-02');
    expect(periodForMonth(2026, 2, 'QUARTERLY')).toBeNull();
    expect(periodForMonth(2026, 6, 'QUARTERLY')).toBe('2026-Q2');
  });
});

describe('eDefterPeriodLabel', () => {
  it('okunur etiket', () => {
    expect(eDefterPeriodLabel('2026-03')).toBe('Mart 2026');
    expect(eDefterPeriodLabel('2026-Q2')).toBe('Nisan–Haziran 2026');
  });
});
