import { describe, expect, it } from 'vitest';
import { demoFirms, filterFirms, calendarDays, demoEvents, filterEvents, planQueries, demoDocuments, ledgerMonths } from './details.ts';

describe('ayrıntılı demo iş akışları', () => {
  it('firma kimlikleri maskelidir; Türkçe arama, tür, sorumlu ve doğrulama filtreleri birlikte çalışır', () => {
    expect(demoFirms.every(f => f.identity.includes('*'))).toBe(true);
    expect(filterFirms(demoFirms, 'İNŞAAT', 'Kurum', 'Demo Ece', 'Aktif')).toHaveLength(1);
    expect(filterFirms(demoFirms, '', 'Şahıs', '', '')).toHaveLength(1);
    expect(filterFirms(demoFirms, 'bulunmaz', '', '', '')).toEqual([]);
  });
  it('ay takvimi pazartesi başlar; artık yıl ve yıl sonu doğru hesaplanır', () => {
    expect(calendarDays('2028-02-10')).toContain('2028-02-29');
    expect(calendarDays('2026-12-15')).toHaveLength(42);
    expect(new Date(`${calendarDays('2026-10-01')[0]}T12:00:00Z`).getUTCDay()).toBe(1);
    expect(filterEvents(demoEvents, ['Kişisel'], ['Not']).every(e => e.source === 'Kişisel' && e.category === 'Not')).toBe(true);
    expect(filterEvents(demoEvents, [], [])).toEqual([]);
  });
  it('aktarımı ay sınırlarında böler, ters veya çok uzun tarih aralığını reddeder', () => {
    const plan = planQueries('2026-07-22', '2026-08-31', ['atlas', 'mavi']);
    expect(plan).toHaveLength(4);
    expect(plan[0]).toMatchObject({ start: '2026-07-22', end: '2026-07-31' });
    expect(planQueries('2026-09-01', '2026-08-31', ['atlas'])).toEqual([]);
    expect(planQueries('2026-02-30', '2026-03-31', ['atlas'])).toEqual([]);
    expect(planQueries('2020-01-01', '2026-12-31', ['atlas'])).toEqual([]);
  });
  it('belge arşivi firma ve dönemleri ayırır; e-Defter ay/çeyrek süzgeci doğrulanır', () => {
    const docs = demoDocuments('atlas', '2026-09');
    expect(docs.map(d => d.kind)).toEqual(expect.arrayContaining(['Vergi levhası', 'SGK tahakkuku', 'SGK hizmet listesi', 'Beyanname', 'Tahakkuk fişi', 'Yevmiye beratı', 'Kebir beratı', 'Yevmiye defteri']));
    expect(docs.every(d => d.firmId === 'atlas' && d.period === '2026-09' && d.name.includes('2026-09'))).toBe(true);
    expect(ledgerMonths('monthly', 8)).toEqual([8]);
    expect(ledgerMonths('quarterly', 3)).toEqual([6, 7, 8]);
    expect(ledgerMonths('monthly', -1)).toHaveLength(12);
    expect(ledgerMonths('quarterly', 5)).toEqual([]);
  });
});
