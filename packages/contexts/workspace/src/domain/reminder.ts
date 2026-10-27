import { addDays, validDate } from './calendar.ts';

// Kişisel hatırlatma (Mert'in takvimindeki calendarTaskForm): yalnız sahibi görür. Uyarı uygulama içidir (takvim ve ana
// sayfada "yaklaşan"); e-posta/SMS yok. Takvim kaydından açılırsa kaynağı (sourceEntry) tutulur.

export const REMINDER_CATEGORIES = [
  { id: 'toplanti', title: 'Toplantı' },
  { id: 'not', title: 'Not' },
  { id: 'dogum_gunu', title: 'Doğum günü' },
  { id: 'tebligat', title: 'Tebligat' },
  { id: 'beyanname', title: 'Beyanname' },
  { id: 'defter', title: 'Defter' },
  { id: 'sgk', title: 'SGK' },
  { id: 'e_imza', title: 'E-imza' },
  { id: 'mali_muhur', title: 'Mali mühür' },
  { id: 'diger', title: 'Diğer' },
] as const;
export type ReminderCategory = (typeof REMINDER_CATEGORIES)[number]['id'];
export const REMINDER_DAYS = [0, 1, 3, 7] as const;

export type ReminderInput = {
  title: string;
  remindOn: string;
  remindTime?: string;
  category: string;
  firmId?: string;
  note?: string;
  remindDays: number;
  sourceEntry?: string;
};
export type ValidReminder = {
  title: string;
  remindOn: string;
  remindTime: string | null;
  category: ReminderCategory;
  firmId: string | null;
  note: string | null;
  remindDays: number;
  sourceEntry: string | null;
};
export type ReminderField = keyof ReminderInput;

const bos = (v: string | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

export function validateReminder(i: ReminderInput): { ok: true; value: ValidReminder } | { ok: false; errors: { field: ReminderField; message: string }[] } {
  const errors: { field: ReminderField; message: string }[] = [];
  const title = (i.title ?? '').trim().replace(/\s+/g, ' ');
  if (!title || title.length > 250) errors.push({ field: 'title', message: 'Başlık 1–250 karakter olmalı.' });
  if (!validDate(i.remindOn ?? '')) errors.push({ field: 'remindOn', message: 'Geçerli bir tarih seçin.' });
  const remindTime = bos(i.remindTime);
  if (remindTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(remindTime)) errors.push({ field: 'remindTime', message: 'Saat SS:DD biçiminde olmalı.' });
  const category = REMINDER_CATEGORIES.find((k) => k.id === i.category)?.id;
  if (!category) errors.push({ field: 'category', message: 'Kategori geçersiz.' });
  const firmId = bos(i.firmId);
  if (firmId && !/^[0-9a-f-]{36}$/.test(firmId)) errors.push({ field: 'firmId', message: 'Mükellef geçersiz.' });
  const note = bos(i.note);
  if (note && note.length > 3000) errors.push({ field: 'note', message: 'Not en fazla 3000 karakter olabilir.' });
  if (!(REMINDER_DAYS as readonly number[]).includes(i.remindDays)) errors.push({ field: 'remindDays', message: 'Hatırlatma günü geçersiz.' });
  const sourceEntry = bos(i.sourceEntry);
  if (sourceEntry && sourceEntry.length > 80) errors.push({ field: 'sourceEntry', message: 'Takvim kaydı geçersiz.' });
  if (errors.length > 0 || !category) return { ok: false, errors };
  return { ok: true, value: { title, remindOn: i.remindOn, remindTime, category, firmId, note, remindDays: i.remindDays, sourceEntry } };
}

/** Uyarı zamanı gelmiş, tarihi geçmemiş, tamamlanmamış hatırlatmalar (tarih sırasında). */
export const dueReminders = <T extends { remindOn: string; remindDays: number; done: boolean }>(list: readonly T[], today: string): T[] =>
  list.filter((r) => !r.done && r.remindOn >= today && addDays(r.remindOn, -r.remindDays) <= today).sort((a, b) => a.remindOn.localeCompare(b.remindOn));
