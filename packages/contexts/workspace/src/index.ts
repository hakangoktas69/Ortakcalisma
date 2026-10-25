// PUBLIC API — workspace bağlamı: görev, not, uyarı/okundu, kontrol listeleri (okuma modeli).
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/workspace.md
export const CONTEXT = 'workspace' as const;

export { DONE, isOverdue, statusPermission, TASK_STATUSES, taskCounters, validateTask, validDay, validNote, type TaskInput, type TaskStatus } from './domain/task.ts';
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
