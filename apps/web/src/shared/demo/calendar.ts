import { demoEvents, demoFirms, normal, shiftDate, type CalendarEvent } from './details.ts';

export const calendarToday = '2026-10-29';
export const calendarSources = [
  { id: 'Kişisel', label: 'Kişisel Notlar', tone: 'personal' }, { id: 'Duyurular', label: 'Duyurular', tone: 'announcements' },
  { id: 'Vergi takvimi', label: 'Vergi Takvimi (GİB)', tone: 'tax' }, { id: 'Resmî tatiller', label: 'Resmî Tatiller', tone: 'holidays' },
];
export const calendarCategories = ['Toplantı', 'Not', 'Doğum günü', 'Tebligat', 'Beyanname', 'Defter', 'SGK', 'E-imza', 'Mali mühür', 'Diğer'].map((id, i) => ({ id, label: id, tone: `category-${i}` }));
// Yalnız demo senaryoları: resmî kaynak veya 8765 kayıtları kopyalanmaz.
export const calendarSeed: CalendarEvent[] = [
  ...demoEvents,
  ...Array.from({ length: 12 }, (_, i) => ({ id: `sample-tax-${i}`, date: `2026-${String(i + 1).padStart(2, '0')}-26`, title: 'Örnek dönem beyanname kontrolü', source: 'Vergi takvimi', category: 'Beyanname', description: 'Kurgusal vergi takvimi senaryosu; resmî vade değildir.', period: `2026-${String(i + 1).padStart(2, '0')}` })),
  ...['Örnek defter yükleme hatırlatması', 'Örnek kurum duyurusu', 'Örnek beyanname ödeme hatırlatması'].map((title, i) => ({ id: `sample-dense-${i}`, date: '2026-10-26', title, source: i === 1 ? 'Duyurular' : 'Vergi takvimi', category: i === 0 ? 'Defter' : 'Beyanname', description: 'Demo örneğidir; gerçek yükümlülük veya süre bilgisi değildir.' })),
];
export const calendarFirm = (event: CalendarEvent) => demoFirms.find(f => f.id === event.firmId)?.name ?? (event.source === 'Vergi takvimi' ? 'Genel vergi takvimi' : event.source === 'Resmî tatiller' ? 'Genel takvim' : 'Genel hatırlatma');
export const calendarCaption = (date: string, options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', ...options }).format(new Date(`${date}T12:00:00Z`));
export const validCalendarDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
export const calendarMonday = (date: string) => shiftDate(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
export function calendarMonthShift(date: string, amount: number): string {
  const d = new Date(`${date.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + amount); return d.toISOString().slice(0, 10);
}
export function calendarScope(date: string, view: string): [string, string] | null {
  if (!validCalendarDate(date)) return null;
  if (view === 'Günlük') return [date, date];
  if (view === 'Haftalık') { const start = calendarMonday(date); return [start, shiftDate(start, 6)]; }
  if (view === 'Yıllık') return [`${date.slice(0, 4)}-01-01`, `${date.slice(0, 4)}-12-31`];
  return [`${date.slice(0, 7)}-01`, shiftDate(calendarMonthShift(date, 1), -1)];
}
export function selectCalendarEvents(events: CalendarEvent[], sources: string[], categories: string[], firmId: string, search: string): CalendarEvent[] {
  return events.filter(e => sources.includes(e.source) && categories.includes(e.category) && (!firmId || ['Vergi takvimi', 'Resmî tatiller'].includes(e.source) || e.firmId === firmId) && normal([e.title, e.description ?? '', calendarFirm(e)].join(' ')).includes(normal(search).trim()))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'tr'));
}
export type ReminderInput = { title: string; date: string; time: string; firmId: string; category: string; owner: string; description: string; reminderDays: number; sourceEventId?: string };
export function reminderFromInput(input: ReminderInput, events: CalendarEvent[]): CalendarEvent | null {
  if (!input.title.trim() || input.title.trim().length > 250 || !validCalendarDate(input.date) || (input.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) || (input.firmId && !demoFirms.some(f => f.id === input.firmId)) || !calendarCategories.some(c => c.id === input.category) || ![0, 1, 3, 7].includes(input.reminderDays) || input.owner.length > 100 || input.description.length > 3000 || events.length >= 100) return null;
  let counter = events.length + 1; while (events.some(e => e.id === `personal-${counter}`)) counter++;
  return { id: `personal-${counter}`, title: input.title.trim().startsWith('Demo · ') ? input.title.trim() : `Demo · ${input.title.trim()}`, date: input.date, source: 'Kişisel', category: input.category,
    ...(input.firmId ? { firmId: input.firmId } : {}), time: input.time, owner: input.owner.trim() || 'Ofis', description: input.description.trim(), reminderDays: input.reminderDays, status: 'Bekliyor', ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}) };
}
export function calendarCsv(events: CalendarEvent[]): string {
  const cell = (value: string) => `"${(/^[\s]*[=+\-@]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
  return '\uFEFF' + [['DEMO — Resmî veri değildir'], ['Tarih', 'Saat', 'Başlık', 'Kaynak', 'Mükellef', 'Sorumlu', 'Durum'], ...events.map(e => [e.date, e.time ?? '', e.title, e.source, calendarFirm(e), e.owner ?? '', e.status ?? ''])].map(row => row.map(cell).join(';')).join('\r\n');
}

// Kaynak taklidi yerel fikstürden yenilenir; kişisel notlar ve durumları korunur.
export function refreshDemoCalendar(events: CalendarEvent[]): CalendarEvent[] {
  return [...calendarSeed.filter(e => e.source !== 'Kişisel').map(e => ({ ...e })), ...events.filter(e => e.source === 'Kişisel')];
}
