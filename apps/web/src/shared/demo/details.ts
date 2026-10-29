import { DEMO_FIRMS } from './model.ts';

export type Firm = { id: string; name: string; identity: string; type: string; regime: string; office: string; email: string; phone: string; city: string; nace: string; activity: string; staff: string; accountant: string; state: string; contract: string; gib: string; sgk: string; invoice: string; dispatch: string; ledger: string };
export const demoFirms: Firm[] = DEMO_FIRMS.map((name, i) => ({ id: ['atlas', 'mavi', 'ornek'][i] ?? 'atlas', name, identity: `DEMO-***${i + 1}`, type: i === 2 ? 'Şahıs' : 'Kurum', regime: i === 2 ? 'Basit Usul' : 'Gerçek Usul', office: 'Demo Vergi Dairesi', email: `firma${i + 1}@example.test`, phone: 'Demo telefon', city: ['İstanbul', 'Ankara', 'İzmir'][i] ?? 'İstanbul', nace: ['620100', '412000', '702200'][i] ?? '620100', activity: ['Yazılım', 'İnşaat', 'Danışmanlık'][i] ?? 'Yazılım', staff: i === 1 ? 'Demo Ece' : 'Demo Deniz', accountant: 'Demo Müşavir', state: i === 2 ? 'Onay bekliyor' : 'Onaylanmış', contract: `DEMO-SOZ-00${i + 1}`, gib: i === 2 ? 'Doğrulanmadı' : 'Aktif', sgk: i === 1 ? 'Aktif değil' : 'Aktif', invoice: i === 2 ? 'Aktif değil' : 'Aktif', dispatch: i === 0 ? 'Aktif' : 'Doğrulanmadı', ledger: i === 2 ? 'Aktif değil' : 'Aktif' }));
export const normal = (s: string) => s.toLocaleLowerCase('tr-TR');
export function filterFirms(firms: Firm[], search: string, type: string, staff: string, state: string): Firm[] {
  const words = normal(search).trim().split(/\s+/);
  return firms.filter(f => words.every(w => normal(Object.values(f).join(' ')).includes(w)) && (!type || f.type === type || f.regime === type) && (!staff || f.staff === staff) && (!state || f.gib === state || f.state === state));
}
export type DemoDocument = { id: string; firmId: string; period: string; kind: string; name: string; size: number };
export function demoDocuments(firmId: string, period: string): DemoDocument[] {
  return ['Vergi levhası', 'Beyanname', 'Tahakkuk fişi', 'SGK tahakkuku', 'SGK hizmet listesi', 'Yevmiye beratı', 'Kebir beratı', 'Yevmiye defteri'].map((kind, i) => ({ id: `${firmId}-${period}-${i}`, firmId, period, kind, name: `DEMO-${firmId}-${period}-${i + 1}.pdf`, size: 20 + i }));
}
export const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
};
export function calendarDays(date: string): string[] {
  const first = `${date.slice(0, 7)}-01`;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => shiftDate(first, i - offset));
}
export type CalendarEvent = { id: string; date: string; title: string; source: string; category: string; firmId?: string; time?: string; description?: string; owner?: string; reminderDays?: number; status?: string; period?: string; sourceEventId?: string };
// Vergi vadesi iddiası yok: bütün tarihler açıkça kurgusal senaryodur.
export const demoEvents: CalendarEvent[] = [
  { id: 'e1', date: '2026-10-05', title: 'Örnek beyanname hatırlatması', source: 'Vergi takvimi', category: 'Beyanname' },
  { id: 'e2', date: '2026-10-15', title: 'Örnek SGK kontrolü', source: 'Duyurular', category: 'SGK' },
  { id: 'e3', date: '2026-10-26', title: 'Örnek firma görüşmesi', source: 'Kişisel', category: 'Toplantı' },
  { id: 'e4', date: '2026-10-29', title: 'Örnek tatil kaydı', source: 'Resmî tatiller', category: 'Diğer' },
  { id: 'e5', date: '2026-10-30', title: 'Örnek dönem notu', source: 'Kişisel', category: 'Not' },
];
export const filterEvents = (events: CalendarEvent[], sources: string[], categories: string[]) => events.filter(e => sources.includes(e.source) && categories.includes(e.category));
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
export type DemoQuery = { id: string; firmId: string; start: string; end: string; state: string; periods?: string[] };
export function planQueries(start: string, end: string, firms: string[]): DemoQuery[] {
  if (!validDate(start) || !validDate(end) || start > end || Number(end.slice(0, 4)) - Number(start.slice(0, 4)) > 1 || !firms.length) return [];
  const periods: { start: string; end: string }[] = [];
  for (let cursor = start; cursor <= end;) {
    const d = new Date(`${cursor}T12:00:00Z`);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
    const stop = last < end ? last : end;
    periods.push({ start: cursor, end: stop }); cursor = shiftDate(stop, 1);
  }
  return firms.flatMap(firmId => periods.map(p => ({ ...p, firmId, id: `${firmId}-${p.start}-${p.end}`, state: 'Bekliyor' })));
}
export function ledgerMonths(mode: string, value: number): number[] {
  if (mode === 'monthly') return value === -1 ? Array.from({ length: 12 }, (_, i) => i) : Number.isInteger(value) && value >= 0 && value < 12 ? [value] : [];
  return Number.isInteger(value) && value >= 1 && value <= 4 ? [0, 1, 2].map(i => (value - 1) * 3 + i) : [];
}
