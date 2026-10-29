import { calendarToday, calendarMonthShift, validCalendarDate } from './calendar.ts';
import { shiftDate } from './details.ts';

export type DeclarationSelection = { mode: 'upload' | 'period'; start: string; end: string; periodStart: string; periodEnd: string; anchor: string | null };
const validMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= '2004-01' && month <= calendarToday.slice(0, 7);
export const lastDeclarationWeek = () => ({ start: shiftDate(calendarToday, -6), end: calendarToday });
export function chooseDeclarationMonth(selection: DeclarationSelection, month: string): DeclarationSelection {
  if (!validMonth(month)) return selection;
  if (selection.mode === 'period') {
    const range = selection.anchor ? [selection.anchor, month].sort() : [month, month];
    return { ...selection, periodStart: range[0] ?? month, periodEnd: range[1] ?? month, anchor: selection.anchor ? null : month };
  }
  const end = shiftDate(calendarMonthShift(`${month}-01`, 1), -1);
  return { ...selection, start: `${month}-01`, end: end > calendarToday ? calendarToday : end };
}
/** null: yükleme tarihine göre; []: geçersiz/boş dönem aralığı. */
export function declarationPeriods(selection: DeclarationSelection): string[] | null {
  if (selection.mode === 'upload') return null;
  if (!validMonth(selection.periodStart) || !validMonth(selection.periodEnd) || selection.periodStart > selection.periodEnd) return [];
  const months: string[] = [];
  for (let month = selection.periodStart; month <= selection.periodEnd && months.length <= 24; month = calendarMonthShift(`${month}-01`, 1).slice(0, 7)) months.push(month);
  return months.length <= 24 ? months : [];
}
export const validDeclarationUpload = (start: string, end: string) => validCalendarDate(start) && validCalendarDate(end) && start >= '2004-01-01' && start <= end && end <= calendarToday;
