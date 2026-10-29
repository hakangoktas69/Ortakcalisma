import { describe, it, expect } from 'vitest';
import { calendarScope, selectCalendarEvents, reminderFromInput, calendarCsv, calendarSeed, calendarSources, calendarCategories } from './calendar.ts';

describe('8765 düzenine uyarlanan sahte takvim', () => {
  it('gün, pazartesi başlayan hafta, ay ve yıl kapsamlarını doğru ayırır', () => {
    expect(calendarScope('2026-10-29', 'Haftalık')).toEqual(['2026-10-26', '2026-11-01']);
    expect(calendarScope('2028-02-29', 'Aylık')).toEqual(['2028-02-01', '2028-02-29']);
    expect(calendarScope('2026-12-31', 'Yıllık')).toEqual(['2026-01-01', '2026-12-31']);
    expect(calendarScope('2026-10-29', 'Günlük')).toEqual(['2026-10-29', '2026-10-29']);
    expect(calendarScope('2026-02-30', 'Liste')).toBeNull();
  });
  it('Türkçe arama ve mükellef süzgeci genel kaynak kayıtlarını korur, diğer firmaların notlarını dışlar', () => {
    const personal = { id: 'x', title: 'Demo İNŞAAT görüşmesi', date: '2026-10-29', source: 'Kişisel', category: 'Not', firmId: 'mavi' };
    const events = [...calendarSeed, personal];
    expect(selectCalendarEvents(events, calendarSources.map(s => s.id), calendarCategories.map(c => c.id), 'mavi', 'İNŞAAT')).toContainEqual(personal);
    expect(selectCalendarEvents(events, ['Kişisel'], ['Not'], 'atlas', '')).not.toContainEqual(personal);
    expect(selectCalendarEvents(events, ['Vergi takvimi'], ['Beyanname'], 'atlas', '').length).toBeGreaterThan(0);
    expect(selectCalendarEvents(events, [], [], '', '')).toEqual([]);
  });
  it('hatırlatmada firma, tarih, saat, kategori ve süre doğrulanır; genel not da mümkündür', () => {
    const input = { title: 'Firma kontrolü', date: '2026-10-29', time: '09:30', firmId: 'atlas', category: 'Not', owner: 'Demo Deniz', description: 'Örnek açıklama', reminderDays: 3 };
    const event = reminderFromInput(input, []);
    expect(event).toMatchObject({ firmId: 'atlas', time: '09:30', reminderDays: 3, owner: 'Demo Deniz', status: 'Bekliyor' });
    expect(reminderFromInput({ ...input, firmId: '' }, [])?.firmId).toBeUndefined();
    for (const patch of [{ date: '2026-02-30' }, { time: '25:00' }, { firmId: 'başka-ofis' }, { category: 'Bilinmeyen' }, { reminderDays: 2 }, { title: ' ' }]) expect(reminderFromInput({ ...input, ...patch }, [])).toBeNull();
    expect(reminderFromInput(input, event ? [event] : [])?.id).not.toEqual(event?.id);
  });
  it('CSV yalnız seçili kapsamı taşır ve formül metinlerini kaçırır', () => {
    const csv = calendarCsv([{ id: 'x', date: '2026-10-29', title: '=HYPERLINK("x")', source: 'Kişisel', category: 'Not', firmId: 'atlas' }]);
    expect(csv).toContain('DEMO'); expect(csv).toContain('Demo Atlas'); expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain('""x""');
  });
});
