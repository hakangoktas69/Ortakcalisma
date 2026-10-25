// Görev (Task) ve not (Note): eski portalın "Takvim ve Görevler" ekranı (başlık, mükellef, son tarih, sorumlu, durum) ve
// firma notları. Saf kurallar: alan doğrulaması, durum yetkisi, gecikme, sayaçlar.

export const TASK_STATUSES = ['Bekliyor', 'Devam Ediyor', 'Öncelikli', 'Tamamlandı'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const DONE: TaskStatus = 'Tamamlandı';

export type TaskInput = { title: string; firmId: string | null; dueOn: string; assigneeId: string | null };
export type TaskField = 'title' | 'dueOn';

const GUN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const validDay = (s: string) => {
  const m = GUN.exec(s);
  if (!m || Number(m[1]) < 2004 || Number(m[1]) > 2100) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export function validateTask(i: TaskInput): { ok: true; value: TaskInput } | { ok: false; errors: { field: TaskField; message: string }[] } {
  const title = (i.title ?? '').trim();
  const errors: { field: TaskField; message: string }[] = [];
  if (!title || title.length > 120) errors.push({ field: 'title', message: 'Görev başlığı 1–120 karakter olmalı.' });
  if (!validDay(i.dueOn ?? '')) errors.push({ field: 'dueOn', message: 'Geçerli bir son tarih seçin.' });
  return errors.length ? { ok: false, errors } : { ok: true, value: { ...i, title } };
}

/** Durum değişikliğinin gerektirdiği yetki: tamamlamak ve tamamlanmışı yeniden açmak "kapat" yetkisidir. */
export const statusPermission = (from: TaskStatus, to: TaskStatus) => (to === DONE || from === DONE ? 'gorevler.close' : 'gorevler.create');

export const isOverdue = (t: { status: TaskStatus; dueOn: string }, today: string) => t.status !== DONE && t.dueOn < today;

export function taskCounters(tasks: readonly { status: TaskStatus; dueOn: string; assigneeId: string | null }[], today: string, me: string) {
  return {
    toplam: tasks.length,
    acik: tasks.filter((t) => t.status !== DONE).length,
    oncelikli: tasks.filter((t) => t.status === 'Öncelikli').length,
    geciken: tasks.filter((t) => isOverdue(t, today)).length,
    bana: tasks.filter((t) => t.assigneeId === me && t.status !== DONE).length,
    tamamlanan: tasks.filter((t) => t.status === DONE).length,
  };
}

export const validNote = (body: string) => {
  const b = (body ?? '').trim();
  return b.length >= 1 && b.length <= 2000 ? b : null;
};
