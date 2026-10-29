import { describe, expect, it } from 'vitest';
import { portfolioAction, portfolioFirms, portfolioFilter, emptyPortfolioFilters } from './firmPortfolio.ts';
import { refreshDemoCalendar, calendarSeed, reminderFromInput } from './calendar.ts';
describe('eksik demo işlemlerinin yerel canlandırılması', () => {
 it('arşivleme ayrı durumdur, kayıt bilgisi korunur ve geri alınabilir', () => {
  const first = portfolioFirms[0]; if (!first) throw new Error('Örnek eksik');
  const archived = portfolioAction(first, 'archive');
  expect(archived.archived).toBe('Evet'); expect(archived.id).toBe(first.id); expect(archived.state).toBe(first.state);
  expect(first.archived).toBe('Hayır');
  expect(portfolioFilter([archived], emptyPortfolioFilters)).toEqual([]);
  expect(portfolioFilter([archived], { ...emptyPortfolioFilters, state: 'Arşivde' })).toEqual([archived]);
  expect(portfolioFilter([portfolioAction(archived, 'restore')], emptyPortfolioFilters)).toHaveLength(1);
 });
 it('örnek kullanım izni onay gerektirir; onay geri alma ve arşiv izni kaldırır', () => {
  const first = portfolioFirms[0]; if (!first) throw new Error('Örnek eksik');
  expect(portfolioAction(first, 'grant').usePermission).toBe('Verilmedi');
  const consented = portfolioAction(first, 'consent');
  const granted = portfolioAction(consented, 'grant');
  expect(granted.usePermission).toBe('Verildi'); expect(first.consent).toBe('Alınmadı');
  expect(portfolioAction(granted, 'revoke-consent').usePermission).toBe('Verilmedi');
  const archived = portfolioAction(granted, 'archive');
  expect(archived.consent).toBe('Alındı'); expect(portfolioAction(archived, 'grant').usePermission).toBe('Verilmedi');
  expect(portfolioAction({ ...consented, gibUser: '', sgkUser: '' }, 'grant').usePermission).toBe('Verilmedi');
 });
 it('kaynak yenileme kişisel notu ve tamamlanma durumunu korur, kayıt çoğaltmaz', () => {
  const note = reminderFromInput({ title: 'Demo kişisel not', date: '2026-10-29', time: '', firmId: 'atlas', category: 'Not', owner: 'Demo', description: 'Örnek not', reminderDays: 1 }, calendarSeed);
  if (!note) throw new Error('Örnek hatırlatma eksik');
  const personal = { ...note, status: 'Tamamlandı' };
  const refreshed = refreshDemoCalendar([personal]);
  expect(refreshed).toContainEqual(personal);
  expect(refreshed.filter(e => e.source !== 'Kişisel')).toHaveLength(calendarSeed.filter(e => e.source !== 'Kişisel').length);
  expect(refreshDemoCalendar(refreshed)).toEqual(refreshed);
  expect(new Set(refreshed.map(e => e.id)).size).toBe(refreshed.length);
 });
});
