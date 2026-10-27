import { err, ok, type Result } from '@eworks/kernel';
import { addDays, validDate } from '../domain/calendar.ts';
import { dueReminders, validateReminder, type ReminderField, type ReminderInput, type ValidReminder } from '../domain/reminder.ts';

// Kişisel hatırlatma use-case'leri (genel_bakis.takvim.remind). Hatırlatma yalnız sahibine görünür (RLS: user_id = app.uid());
// firmaya bağlıysa firma kullanıcının kapsamında olmalı (RLS: can_see_firm). Uyarı uygulama içidir.

export type Ctx = { readonly sub?: string; readonly org: string };
export type Reminder = ValidReminder & { id: string; done: boolean; firmTitle: string | null };

export interface ReminderRepository {
  list(ctx: Ctx, from: string, to: string): Promise<Reminder[]>;
  /** 'firma_yok': firma yok ya da kullanıcının kapsamında değil. */
  insert(ctx: Ctx, r: ValidReminder): Promise<Result<string, 'firma_yok'>>;
  setDone(ctx: Ctx, id: string, done: boolean): Promise<boolean>;
  remove(ctx: Ctx, id: string): Promise<boolean>;
}
export type ReminderDeps = { reminders: ReminderRepository };
type Can = (key: string) => boolean;
const ANAHTAR = 'genel_bakis.takvim.remind';
/** En uzun hatırlatma süresi (7 gün): yaklaşanlar bugünden 7 gün sonrasına kadar aranır. */
const ILERI = 7;

export async function createReminder(
  ctx: Ctx,
  input: ReminderInput,
  can: Can,
  d: ReminderDeps,
): Promise<Result<{ id: string }, 'yetki_yok' | 'gecersiz'> & { errors?: { field: ReminderField; message: string }[] }> {
  if (!can(ANAHTAR)) return err('yetki_yok');
  const v = validateReminder(input);
  if (!v.ok) return { ok: false, error: 'gecersiz', errors: v.errors };
  const r = await d.reminders.insert(ctx, v.value);
  if (!r.ok) return { ok: false, error: 'gecersiz', errors: [{ field: 'firmId', message: 'Mükellef geçersiz.' }] };
  return ok({ id: r.value });
}

export async function listReminders(ctx: Ctx, from: string, to: string, d: ReminderDeps): Promise<Result<Reminder[], 'gecersiz_aralik'>> {
  if (!validDate(from) || !validDate(to) || to < from || addDays(from, 400) < to) return err('gecersiz_aralik');
  return ok(await d.reminders.list(ctx, from, to));
}

/** Uyarı zamanı gelmiş hatırlatmalar (takvim ve ana sayfa). */
export const upcomingReminders = async (ctx: Ctx, today: string, d: ReminderDeps) => dueReminders(await d.reminders.list(ctx, today, addDays(today, ILERI)), today);

export async function setReminderDone(ctx: Ctx, id: string, done: boolean, can: Can, d: ReminderDeps): Promise<Result<{ id: string }, 'yetki_yok' | 'bulunamadi'>> {
  if (!can(ANAHTAR)) return err('yetki_yok');
  return (await d.reminders.setDone(ctx, id, done)) ? ok({ id }) : err('bulunamadi');
}

export async function deleteReminder(ctx: Ctx, id: string, can: Can, d: ReminderDeps): Promise<Result<{ id: string }, 'yetki_yok' | 'bulunamadi'>> {
  if (!can(ANAHTAR)) return err('yetki_yok');
  return (await d.reminders.remove(ctx, id)) ? ok({ id }) : err('bulunamadi');
}
