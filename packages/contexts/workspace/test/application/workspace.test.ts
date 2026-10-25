import { describe, expect, it } from 'vitest';
import { addNote, assignTask, changeStatus, createTask, isOverdue, statusPermission, taskCounters, validateTask, type Task, type TaskRepository } from '../../src/index.ts';

const ctx = { sub: 'u-1', org: 'o-1' };
const uyeler = new Set(['u-1', 'u-2']);
const members = { isStaff: async (_c: unknown, id: string) => uyeler.has(id) };

function depo(baslangic: Task[] = []) {
  const g = new Map(baslangic.map((t) => [t.id, t]));
  const r: TaskRepository = {
    list: async () => [...g.values()],
    get: async (_c, id) => g.get(id) ?? null,
    insert: async (_c, t) => {
      const id = `t-${g.size + 1}`;
      g.set(id, { id, title: t.title, firmId: t.firmId, firmTitle: null, dueOn: t.dueOn, status: 'Bekliyor', assigneeId: t.assigneeId, createdBy: ctx.sub, createdAt: '', version: 1 });
      return id;
    },
    update: async (_c, id, v, p) => {
      const t = g.get(id);
      if (!t) return 'bulunamadi';
      if (t.version !== v) return 'catisma';
      g.set(id, { ...t, ...(p.status ? { status: p.status } : {}), ...('assigneeId' in p ? { assigneeId: p.assigneeId ?? null } : {}), version: v + 1 });
      return 'ok';
    },
  };
  return { r, g };
}
const hepsi = () => true;
const yalniz = (...k: string[]) => (key: string) => k.includes(key);

describe('görevler', () => {
  it('başlık ve son tarih doğrulanır', () => {
    expect(validateTask({ title: '  ', firmId: null, dueOn: '2026-02-30', assigneeId: null })).toMatchObject({ ok: false, errors: [{ field: 'title' }, { field: 'dueOn' }] });
    expect(validateTask({ title: ' Kontrol ', firmId: null, dueOn: '2026-10-31', assigneeId: null })).toMatchObject({ ok: true, value: { title: 'Kontrol' } });
  });

  it('sorumlu verilmezse oluşturana; başkasına atamak "ata" yetkisi ister; ofis dışı kişiye atanmaz', async () => {
    const { r, g } = depo();
    const d = { tasks: r, members };
    const temel = { title: 'Beyanname kontrolü', firmId: null, dueOn: '2026-10-31' };
    expect((await createTask(ctx, { ...temel, assigneeId: null }, yalniz('gorevler.create'), d)).ok).toBe(true);
    expect(g.get('t-1')?.assigneeId).toBe('u-1');
    expect(await createTask(ctx, { ...temel, assigneeId: 'u-2' }, yalniz('gorevler.create'), d)).toEqual({ ok: false, error: 'yetki_yok' });
    expect(await createTask(ctx, { ...temel, assigneeId: 'yabanci' }, hepsi, d)).toEqual({ ok: false, error: 'uye_degil' });
    expect((await createTask(ctx, { ...temel, assigneeId: 'u-2' }, hepsi, d)).ok).toBe(true);
  });

  it('tamamlamak ve yeniden açmak "kapat" yetkisi ister; eski sürümle güncelleme çatışmadır', async () => {
    const t: Task = { id: 'x', title: 'a', firmId: null, firmTitle: null, dueOn: '2026-10-01', status: 'Bekliyor', assigneeId: 'u-1', createdBy: 'u-1', createdAt: '', version: 1 };
    const { r } = depo([t]);
    expect(await changeStatus(ctx, 'x', 1, 'Tamamlandı', yalniz('gorevler.create'), { tasks: r })).toEqual({ ok: false, error: 'yetki_yok' });
    expect((await changeStatus(ctx, 'x', 1, 'Devam Ediyor', yalniz('gorevler.create'), { tasks: r })).ok).toBe(true);
    expect(await changeStatus(ctx, 'x', 1, 'Öncelikli', hepsi, { tasks: r })).toEqual({ ok: false, error: 'catisma' });
    expect(await changeStatus(ctx, 'x', 2, 'Silindi', hepsi, { tasks: r })).toEqual({ ok: false, error: 'gecersiz' });
    expect((await changeStatus(ctx, 'x', 2, 'Tamamlandı', yalniz('gorevler.close'), { tasks: r })).ok).toBe(true);
    expect(statusPermission('Tamamlandı', 'Bekliyor')).toBe('gorevler.close');
    expect(await assignTask(ctx, 'x', 3, 'yabanci', { tasks: r, members })).toEqual({ ok: false, error: 'uye_degil' });
    expect((await assignTask(ctx, 'x', 3, 'u-2', { tasks: r, members })).ok).toBe(true);
  });

  it('sayaçlar ve gecikme', () => {
    const t = (status: Task['status'], dueOn: string, assigneeId: string | null) => ({ status, dueOn, assigneeId });
    const s = taskCounters([t('Bekliyor', '2026-10-01', 'u-1'), t('Öncelikli', '2026-11-01', 'u-2'), t('Tamamlandı', '2026-09-01', 'u-1')], '2026-10-25', 'u-1');
    expect(s).toEqual({ toplam: 3, acik: 2, oncelikli: 1, geciken: 1, bana: 1, tamamlanan: 1 });
    expect(isOverdue({ status: 'Tamamlandı', dueOn: '2020-01-01' }, '2026-10-25')).toBe(false);
  });
});

describe('notlar', () => {
  it('boş ya da çok uzun not ve firmasız not kaydedilmez', async () => {
    const kayit: string[] = [];
    const d = { notes: { list: async () => [], insert: async (_c: unknown, _f: string, b: string) => (kayit.push(b), 'n-1') } };
    expect(await addNote(ctx, 'f', '   ', d)).toEqual({ ok: false, error: 'gecersiz' });
    expect(await addNote(ctx, '', 'metin', d)).toEqual({ ok: false, error: 'gecersiz' });
    expect(await addNote(ctx, 'f', 'x'.repeat(2001), d)).toEqual({ ok: false, error: 'gecersiz' });
    expect(await addNote(ctx, 'f', '  Ekim KDV için evrak bekleniyor ', d)).toEqual({ ok: true, value: { id: 'n-1' } });
    expect(kayit).toEqual(['Ekim KDV için evrak bekleniyor']);
  });
});
