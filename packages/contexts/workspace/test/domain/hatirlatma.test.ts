import { describe, expect, it } from 'vitest';
import { dueReminders, REMINDER_CATEGORIES, validateReminder } from '../../src/index.ts';

// Kişisel hatırlatma (Mert 26.10 takvimi: kategori, saat, not, mükellef, 0/1/3/7 gün önce). Uyarı uygulama içidir.
describe('hatırlatma', () => {
  it('geçerli hatırlatmayı normalleştirir; saat, mükellef ve not isteğe bağlı', () => {
    const r = validateReminder({ title: '  KDV   kontrolü ', remindOn: '2026-10-28', remindTime: '', category: 'beyanname', firmId: '', note: '', remindDays: 3, sourceEntry: 'gib:1' });
    expect(r).toEqual({ ok: true, value: { title: 'KDV kontrolü', remindOn: '2026-10-28', remindTime: null, category: 'beyanname', firmId: null, note: null, remindDays: 3, sourceEntry: 'gib:1' } });
    expect(validateReminder({ title: 'Toplantı', remindOn: '2026-10-28', remindTime: '14:30', category: 'toplanti', remindDays: 0 }).ok).toBe(true);
  });

  it('eksik başlık, geçersiz tarih/saat/kategori/gün ve uzun not alan bazında reddedilir', () => {
    const r = validateReminder({ title: ' ', remindOn: '2026-02-30', remindTime: '25:00', category: 'parti', remindDays: 5, note: 'x'.repeat(3001), firmId: 'firma' });
    expect(!r.ok && r.errors.map((e) => e.field).sort()).toEqual(['category', 'firmId', 'note', 'remindDays', 'remindOn', 'remindTime', 'title']);
  });

  it('kategoriler Mert\'in takvimindeki gibi', () => {
    expect(REMINDER_CATEGORIES.map((k) => k.title)).toEqual(['Toplantı', 'Not', 'Doğum günü', 'Tebligat', 'Beyanname', 'Defter', 'SGK', 'E-imza', 'Mali mühür', 'Diğer']);
  });

  it('yaklaşan: hatırlatma günü geldi, tarih geçmedi, tamamlanmadı; tarihe göre sıralı', () => {
    const h = (id: string, remindOn: string, remindDays: number, done = false) => ({ id, remindOn, remindDays, done });
    const liste = [h('a', '2026-10-30', 3), h('b', '2026-10-31', 3), h('c', '2026-10-27', 0), h('d', '2026-10-26', 7), h('e', '2026-10-28', 1, true), h('f', '2026-11-03', 7)];
    expect(dueReminders(liste, '2026-10-27').map((x) => x.id)).toEqual(['c', 'a', 'f']);
  });
});
