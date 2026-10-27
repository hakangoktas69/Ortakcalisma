// PUBLIC API — workspace bağlamı: görev, not, uyarı/okundu, kontrol listeleri (okuma modeli).
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/workspace.md
export const CONTEXT = 'workspace' as const;

export { DONE, isOverdue, statusPermission, TASK_STATUSES, taskCounters, validateTask, validDay, validNote, type TaskInput, type TaskStatus } from './domain/task.ts';
export { PORTAL_GROUPS, PORTAL_LINKS, type PortalGroup, type PortalLink } from './domain/portal-links.ts';
export {
  addDays,
  buildYear,
  CALENDAR_CATEGORIES,
  CALENDAR_SOURCES,
  gibEntries,
  holidayDates,
  isWorkday,
  nationalHolidays,
  nextWorkday,
  periodEntries,
  religiousHolidays,
  sgkPremiumEntries,
  validDate,
  type CalendarCategory,
  type CalendarEntry,
  type CalendarSource,
  type Certainty,
  type GibCalendarError,
  type GibCalendarRecord,
  type GibCalendarSnapshot,
  type ReligiousDates,
  type SourceInfo,
  type YearSources,
} from './domain/calendar.ts';
export {
  dueReminders,
  REMINDER_CATEGORIES,
  REMINDER_DAYS,
  validateReminder,
  type ReminderCategory,
  type ReminderField,
  type ReminderInput,
  type ValidReminder,
} from './domain/reminder.ts';
export {
  createReminder,
  deleteReminder,
  listReminders,
  setReminderDone,
  upcomingReminders,
  type Reminder,
  type ReminderDeps,
  type ReminderRepository,
} from './application/reminders.ts';
export {
  applyCalendarSources,
  correctEntry,
  ensureCalendarYear,
  listCalendar,
  type CalendarDeps,
  type CalendarRepository,
  type CalendarSourcePort,
  type StoredEntry,
  type ViewEntry,
} from './application/calendar.ts';
export {
  addNote,
  assignTask,
  changeStatus,
  createTask,
  listNotes,
  listTasks,
  type Can,
  type MemberPort,
  type Ctx,
  type Note,
  type NoteRepository,
  type Task,
  type TaskError,
  type TaskRepository,
} from './application/workspace.ts';
export { PgNoteRepository, PgTaskRepository } from './infrastructure/pg-workspace.ts';
export { BundledCalendarSources, PgCalendarRepository } from './infrastructure/pg-calendar.ts';
export { PgReminderRepository } from './infrastructure/pg-reminders.ts';
