import { describe, expect, it } from 'vitest';
import { createReminder, deleteReminder, listReminders, setReminderDone, upcomingReminders, type Reminder, type ReminderRepository } from '../../src/index.ts';

const ctx = { sub: 'u-1', org: 'o-1' };
const izinli = (k: string) => k === 'genel_bakis.takvim.remind';

function fakes(gorunmeyenFirma = 'f-baska') {
  const kayit = new Map<string, Reminder>();
  let n = 0;
  const repo: ReminderRepository = {
    list: async (_c, from, to) => [...kayit.values()].filter((r) => r.remindOn >= from && r.remindOn <= to),
    insert: async (_c, r) => {
      if (r.firmId === gorunmeyenFirma) return { ok: false, error: 'firma_yok' };
      const id = `h-${++n}`;
      kayit.set(id, { ...r, id, done: false, firmTitle: r.firmId ? 'Firma' : null });
      return { ok: true, value: id };
    },
    setDone: async (_c, id, done) => {
      const r = kayit.get(id);
      if (!r) return false;
      kayit.set(id, { ...r, done });
      return true;
    },
    remove: async (_c, id) => kayit.delete(id),
  };
  return { d: { reminders: repo }, kayit };
}

const girdi = { title: 'KDV kontrolü', remindOn: '2026-10-30', category: 'beyanname', remindDays: 3 };

describe('hatırlatma use-case\'leri', () => {
  it('[F:genel_bakis.takvim.remind] oluşturulur, aralıkta listelenir, yaklaşanlarda görünür, tamamlanınca düşer, silinir', async () => {
    const f = fakes();
    const r = await createReminder(ctx, girdi, izinli, f.d);
    expect(r).toEqual({ ok: true, value: { id: 'h-1' } });
    expect((await listReminders(ctx, '2026-10-01', '2026-10-31', f.d)).ok).toBe(true);
    expect((await upcomingReminders(ctx, '2026-10-27', f.d)).map((x) => x.id)).toEqual(['h-1']);
    expect((await upcomingReminders(ctx, '2026-10-26', f.d)).map((x) => x.id)).toEqual([]);
    expect(await setReminderDone(ctx, 'h-1', true, izinli, f.d)).toEqual({ ok: true, value: { id: 'h-1' } });
    expect(await upcomingReminders(ctx, '2026-10-27', f.d)).toEqual([]);
    expect(await deleteReminder(ctx, 'h-1', izinli, f.d)).toEqual({ ok: true, value: { id: 'h-1' } });
    expect(f.kayit.size).toBe(0);
  });

  it('yetkisiz, geçersiz, kapsam dışı firma, olmayan kayıt ve geçersiz aralık', async () => {
    const f = fakes();
    expect(await createReminder(ctx, girdi, () => false, f.d)).toEqual({ ok: false, error: 'yetki_yok' });
    expect(await createReminder(ctx, { ...girdi, title: '' }, izinli, f.d)).toMatchObject({ ok: false, error: 'gecersiz', errors: [{ field: 'title' }] });
    expect(await createReminder(ctx, { ...girdi, firmId: 'f-baska' }, izinli, f.d)).toEqual({ ok: false, error: 'gecersiz', errors: [{ field: 'firmId', message: 'Mükellef geçersiz.' }] });
    expect(await setReminderDone(ctx, 'yok', true, izinli, f.d)).toEqual({ ok: false, error: 'bulunamadi' });
    expect(await deleteReminder(ctx, 'yok', izinli, f.d)).toEqual({ ok: false, error: 'bulunamadi' });
    expect(await setReminderDone(ctx, 'h-1', true, () => false, f.d)).toEqual({ ok: false, error: 'yetki_yok' });
    expect(await deleteReminder(ctx, 'h-1', () => false, f.d)).toEqual({ ok: false, error: 'yetki_yok' });
    expect(await listReminders(ctx, '2026-10-31', '2026-10-01', f.d)).toEqual({ ok: false, error: 'gecersiz_aralik' });
  });
});
