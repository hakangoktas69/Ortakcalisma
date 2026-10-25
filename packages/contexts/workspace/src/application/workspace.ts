import { err, ok, type Result } from '@eworks/kernel';
import { statusPermission, TASK_STATUSES, validateTask, validNote, type TaskField, type TaskInput, type TaskStatus } from '../domain/task.ts';

// Görev ve not use-case'leri (kullanıcı bağlamı). Yetki anahtarı BFF'te, kapsam RLS'te; burada iş kuralları ve yetkinin
// duruma göre seçimi. Atama ve kapatma denetim kaydına yazılır.

export type Ctx = { readonly sub: string; readonly org: string };
export type Can = (key: string) => boolean;

export type Task = {
  id: string;
  title: string;
  firmId: string | null;
  firmTitle: string | null;
  dueOn: string;
  status: TaskStatus;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  version: number;
};

export type Note = { id: string; firmId: string; firmTitle: string; body: string; authorId: string; createdAt: string };

export interface TaskRepository {
  list(ctx: Ctx): Promise<Task[]>;
  get(ctx: Ctx, id: string): Promise<Task | null>;
  insert(ctx: Ctx, t: TaskInput): Promise<string>;
  /** İyimser kilit: sürüm tutmazsa 'catisma', kayıt görünmez/güncellenemezse 'bulunamadi'. */
  update(ctx: Ctx, id: string, version: number, patch: { status?: TaskStatus; assigneeId?: string | null }): Promise<'ok' | 'catisma' | 'bulunamadi'>;
}

/** identity-access bağlamına giden port: kullanıcı ofisin iç kullanıcısı mı (görev sorumlusu olabilir mi)? */
export interface MemberPort {
  isStaff(ctx: Ctx, userId: string): Promise<boolean>;
}

export interface NoteRepository {
  list(ctx: Ctx, firmId?: string): Promise<Note[]>;
  insert(ctx: Ctx, firmId: string, body: string): Promise<string>;
}

export type TaskError = 'gecersiz' | 'yetki_yok' | 'bulunamadi' | 'catisma' | 'uye_degil';

export const listTasks = (ctx: Ctx, d: { tasks: TaskRepository }) => d.tasks.list(ctx);

export async function createTask(ctx: Ctx, input: TaskInput, can: Can, d: { tasks: TaskRepository; members: MemberPort }): Promise<Result<{ id: string }, TaskError> & { errors?: { field: TaskField; message: string }[] }> {
  const v = validateTask(input);
  if (!v.ok) return { ...err('gecersiz'), errors: v.errors };
  // Sorumlu verilmezse görev oluşturana; başkasına atamak "ata" yetkisi ister
  const assignee = v.value.assigneeId ?? ctx.sub;
  if (assignee !== ctx.sub && !can('gorevler.assign')) return err('yetki_yok');
  if (!(await d.members.isStaff(ctx, assignee))) return err('uye_degil');
  return ok({ id: await d.tasks.insert(ctx, { ...v.value, assigneeId: assignee }) });
}

export async function changeStatus(ctx: Ctx, id: string, version: number, to: string, can: Can, d: { tasks: TaskRepository }): Promise<Result<{ id: string }, TaskError>> {
  if (!(TASK_STATUSES as readonly string[]).includes(to)) return err('gecersiz');
  const t = await d.tasks.get(ctx, id);
  if (!t) return err('bulunamadi');
  if (!can(statusPermission(t.status, to as TaskStatus))) return err('yetki_yok');
  const r = await d.tasks.update(ctx, id, version, { status: to as TaskStatus });
  return r === 'ok' ? ok({ id }) : err(r);
}

export async function assignTask(ctx: Ctx, id: string, version: number, assigneeId: string | null, d: { tasks: TaskRepository; members: MemberPort }): Promise<Result<{ id: string }, TaskError>> {
  if (assigneeId && !(await d.members.isStaff(ctx, assigneeId))) return err('uye_degil');
  const r = await d.tasks.update(ctx, id, version, { assigneeId });
  return r === 'ok' ? ok({ id }) : err(r);
}

export const listNotes = (ctx: Ctx, d: { notes: NoteRepository }, firmId?: string) => d.notes.list(ctx, firmId);

export async function addNote(ctx: Ctx, firmId: string, body: string, d: { notes: NoteRepository }): Promise<Result<{ id: string }, 'gecersiz'>> {
  const b = validNote(body);
  if (!b || !firmId) return err('gecersiz');
  return ok({ id: await d.notes.insert(ctx, firmId, b) });
}
