import { describe, it, expect } from 'vitest';
import { chooseDeclarationMonth, declarationPeriods, lastDeclarationWeek, type DeclarationSelection } from './declarationDates.ts';

const selection: DeclarationSelection = { mode: 'upload', start: '2026-07-22', end: '2026-08-31', periodStart: '', periodEnd: '', anchor: null };
describe('beyanname zaman seçimi', () => {
  it('yükleme ayını gerçek ay sonuna kadar seçer; artık yılı ve içinde bulunulan ayı sınırlar', () => {
    expect(chooseDeclarationMonth(selection, '2024-02')).toMatchObject({ start: '2024-02-01', end: '2024-02-29' });
    expect(chooseDeclarationMonth(selection, '2026-10')).toMatchObject({ start: '2026-10-01', end: '2026-10-29' });
    expect(chooseDeclarationMonth(selection, '2026-11')).toEqual(selection);
    expect(chooseDeclarationMonth(selection, '2026-13')).toEqual(selection);
  });
  it('ilk ve son ayı iki tıklamada seçer; dönem seçimi yükleme tarihlerini değiştirmez', () => {
    const first = chooseDeclarationMonth({ ...selection, mode: 'period' }, '2026-09');
    const second = chooseDeclarationMonth(first, '2026-07');
    expect(second).toMatchObject({ periodStart: '2026-07', periodEnd: '2026-09', start: selection.start, end: selection.end, anchor: null });
    expect(declarationPeriods(second)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(declarationPeriods(selection)).toBeNull();
    expect(declarationPeriods({ ...selection, mode: 'period' })).toEqual([]);
  });
  it('son yedi gün kapsayıcıdır; boş, ters ve çok uzun dönemleri reddeder', () => {
    expect(lastDeclarationWeek()).toEqual({ start: '2026-10-23', end: '2026-10-29' });
    expect(declarationPeriods({ ...selection, mode: 'period', periodStart: '2026-09', periodEnd: '2026-07' })).toEqual([]);
    expect(declarationPeriods({ ...selection, mode: 'period', periodStart: '2004-01', periodEnd: '2026-10' })).toEqual([]);
  });
});
