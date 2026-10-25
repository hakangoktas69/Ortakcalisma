import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Session, type TestApp, bootApp, expectNoFullTckn, stack } from './support/app.js';

// notifications (bildirim merkezi, WhatsApp ayarları, hatırlatıcı) ve workspace (iş kutusu, özet, CSV raporlar) regresyonu.

let t: TestApp;
let admin: Session;
let staff: Session;

beforeAll(async () => {
  t = await bootApp();
  admin = await t.login(stack().demo.email, stack().demo.password);
  staff = await t.login(stack().demo.staffEmail, stack().demo.staffPassword);
}, 120_000);
afterAll(() => t?.close());

describe('bildirimler', () => {
  it('hatırlatıcılar (yönetici) bildirim üretir; okunma kullanıcı bazında', async () => {
    await t.http().post('/api/notifications/reminders/run').set(staff.auth).expect(403);
    const run = await t.http().post('/api/notifications/reminders/run').set(admin.auth).expect(201);
    expect(typeof run.body.created).toBe('number');
    const list = await t.http().get('/api/notifications').set(admin.auth).expect(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    const id = list.body.items[0].id;
    await t.http().post(`/api/notifications/${id}/read`).set(admin.auth).expect(201);
    const mine = await t.http().get('/api/notifications').set(admin.auth).expect(200);
    expect(mine.body.items.find((n: { id: string }) => n.id === id).isRead).toBe(true);
    const theirs = await t.http().get('/api/notifications').set(staff.auth).expect(200);
    expect(theirs.body.items.find((n: { id: string }) => n.id === id)?.isRead ?? false).toBe(false);
    await t.http().post('/api/notifications/read-all').set(admin.auth).expect(201);
    const unread = await t.http().get('/api/notifications').query({ unread: '1' }).set(admin.auth).expect(200);
    expect(unread.body.unread).toBe(0);
    await t.http().post('/api/notifications/olmayan/read').set(admin.auth).expect((r) => expect([200, 201]).toContain(r.status));
  });

  it('başka büronun bildirimi okundu işaretlenemez', async () => {
    const other = await t.db.notification.create({ data: { tenantId: stack().B.id, title: 'B bildirimi', category: 'SISTEM' } });
    await t.http().post(`/api/notifications/${other.id}/read`).set(admin.auth);
    expect(await t.db.notificationRead.count({ where: { notificationId: other.id } })).toBe(0);
  });

  it('WhatsApp: numara + açık rıza; numara değişince rıza düşer; deneme mesajı', async () => {
    const ch = await t.http().get('/api/notifications/channels').set(admin.auth).expect(200);
    expect(ch.body).toBeTruthy();
    await t.http().put('/api/me/notification-settings').set(admin.auth).send({ phone: '123' }).expect(400);
    await t.http().put('/api/me/notification-settings').set(admin.auth).send({ phone: '0532 123 45 67', whatsappEnabled: true }).expect(400);
    const on = await t.http().put('/api/me/notification-settings').set(admin.auth).send({ phone: '0532 123 45 67', whatsappEnabled: true, consent: true, categories: ['TEBLIGAT', 'SGK_RAPOR'] }).expect(200);
    expect(on.body).toMatchObject({ phone: '905321234567', whatsappEnabled: true });
    expect(on.body.whatsappOptInAt).toBeTruthy();
    const test = await t.http().post('/api/me/notification-settings/test').set(admin.auth).expect(201);
    expect(test.body).toMatchObject({ ok: true, mode: 'mock' });
    const changed = await t.http().put('/api/me/notification-settings').set(admin.auth).send({ phone: '0533 000 00 00' }).expect(200);
    expect(changed.body).toMatchObject({ whatsappEnabled: false, whatsappOptInAt: null });
    await t.http().post('/api/me/notification-settings/test').set(admin.auth).expect(400);
    await t.http().put('/api/me/notification-settings').set(admin.auth).send({ phone: '', categories: ['YOK'] }).expect(400);
  });
});

describe('iş kutusu, özet ve raporlar', () => {
  it('iş kutusu: işler önem sırasıyla, kişisel veri maskeli; ertele / geri al', async () => {
    const inbox = await t.http().get('/api/inbox').set(admin.auth).expect(200);
    expect(inbox.body.items.length).toBeGreaterThan(0);
    expectNoFullTckn(inbox.body);
    const key = inbox.body.items[0].key;
    await t.http().post('/api/inbox/snooze').set(admin.auth).send({ key, days: 2 }).expect(400);
    await t.http().post('/api/inbox/snooze').set(admin.auth).send({ key: 'kotu:anahtar', days: 1 }).expect(400);
    await t.http().post('/api/inbox/snooze').set(admin.auth).send({ key, days: 3 }).expect(201);
    const snoozed = await t.http().get('/api/inbox').set(staff.auth).expect(200);
    expect(snoozed.body.items.find((i: { key: string }) => i.key === key).snoozedUntil).toBeTruthy(); // büro genelinde
    await t.http().post('/api/inbox/unsnooze').set(admin.auth).send({ key }).expect(201);
    const back = await t.http().get('/api/inbox').set(admin.auth).expect(200);
    expect(back.body.items.find((i: { key: string }) => i.key === key).snoozedUntil).toBeNull();
  });

  it('özet ekranı bütün bölümleri döner', async () => {
    const res = await t.http().get('/api/dashboard/summary').set(admin.auth).expect(200);
    for (const k of ['companies', 'license', 'sgk']) expect(res.body).toHaveProperty(k);
    expect(res.body.companies.total).toBeGreaterThan(0);
  });

  it.each(['firmalar', 'beyanname', 'edefter', 'tebligat', 'sgk-rapor', 'ise-giris-cikis'])('CSV raporu: %s (BOM, ; ayraç, formül enjeksiyonu yok, denetim kaydı)', async (kind) => {
    const before = await t.db.auditLog.count({ where: { action: 'report.export', tenantId: stack().demo.id } });
    const res = await t.http().get(`/api/reports/${kind}`).query({ month: '2026-08', days: 365 }).set(admin.auth).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    const text = (res.body as Buffer).toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.split('\n')[0]).toContain(';');
    expect(text).not.toMatch(/;[=+@]/);
    expect(res.headers['content-disposition']).toMatch(/\.csv/);
    expect(await t.db.auditLog.count({ where: { action: 'report.export', tenantId: stack().demo.id } })).toBe(before + 1);
  });

  it('bilinmeyen rapor türü 400/404', async () => {
    const res = await t.http().get('/api/reports/yok').set(admin.auth);
    expect([400, 404]).toContain(res.status);
  });
});
