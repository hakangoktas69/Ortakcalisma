import { describe, expect, it } from 'vitest';
import { calendarDaysBetween } from './reminders.service.js';

describe('calendarDaysBetween', () => {
  it('saatleri yok sayar', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 25, 9, 0), new Date(2026, 9, 28, 23, 59, 59))).toBe(3);
    expect(calendarDaysBetween(new Date(2026, 9, 12, 17, 30), new Date(2026, 9, 17, 23, 59, 59))).toBe(5);
  });
  it('aynı gün 0, geçmiş negatif', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 28, 8, 30), new Date(2026, 9, 28, 23, 59, 59))).toBe(0);
    expect(calendarDaysBetween(new Date(2026, 9, 29, 8, 30), new Date(2026, 9, 28, 23, 59, 59))).toBe(-1);
  });
  it('ay sonunu geçer', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 30), new Date(2026, 10, 2))).toBe(3);
  });
});
