import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTckn } from '../src/shared-kernel/testing/test-tckn.js';
import { type TestApp, bootApp, stack } from './support/app.js';

// Worker süreci regresyonu: modül bağımlılıkları (DI) çözülür, outbox olayları bildirime dönüşür,
// WhatsApp gönderimi kişisel veri içermez, hatırlatıcılar ve kişisel veri dönüşümü çalışır.

let t: TestApp;
let worker: INestApplicationContext;

beforeAll(async () => {
  t = await bootApp();
  const { WorkerModule } = await import('../src/worker.module.js');
  worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
  await worker.init();
}, 120_000);
afterAll(async () => {
  await worker?.close();
  await t?.close();
});

async function dispatchAll() {
  const { OutboxDispatcher } = await import('../src/platform/events/outbox.dispatcher.js');
  const d = worker.get(OutboxDispatcher);
  while ((await d.dispatchBatch()) > 0);
}

async function until<T>(fn: () => Promise<T | null | undefined | false>, ms = 15_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('Zaman aşımı');
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe('worker', () => {
  it('WorkerModule bütün bağımlılıklarıyla açılır', () => {
    expect(worker).toBeTruthy();
  });

  it('olaylar bildirime dönüşür; aynı olay iki kez bildirim üretmez', async () => {
    const tenantId = stack().demo.id;
    const ev = await t.db.outboxEvent.create({
      data: { tenantId, type: 'tebligat.imported', payload: { companyId: stack().demo.companyId, companyTitle: 'Gizli Unvan A.Ş.', count: 2, first: { subject: 'İhbarname', sender: 'VD', deemedServedAt: new Date().toISOString() } } },
    });
    await dispatchAll();
    const n = await t.db.notification.findUniqueOrThrow({ where: { tenantId_dedupeKey: { tenantId, dedupeKey: `event:${ev.id}` } } });
    expect(n.title).toContain('Gizli Unvan A.Ş.');
    expect(n.externalBody).not.toContain('Gizli Unvan'); // dış kanala unvan gitmez
    expect((await t.db.outboxEvent.findUniqueOrThrow({ where: { id: ev.id } })).processedAt).toBeTruthy();

    // Yeniden teslim (ör. çökme sonrası) ikinci bildirim üretmez
    await t.db.outboxEvent.update({ where: { id: ev.id }, data: { processedAt: null } });
    await dispatchAll();
    expect(await t.db.notification.count({ where: { tenantId, dedupeKey: `event:${ev.id}` } })).toBe(1);
  });

  it('SGK e-rapor olayı: uygulama içinde ad görünür, dış kanala yalnız sayı gider', async () => {
    const tenantId = stack().demo.id;
    const ev = await t.db.outboxEvent.create({ data: { tenantId, type: 'sgk.reports.received', payload: { workplaceId: 'w', companyTitle: 'Firma', count: 1, names: ['Ayşe Hasta'] } } });
    await dispatchAll();
    const n = await t.db.notification.findUniqueOrThrow({ where: { tenantId_dedupeKey: { tenantId, dedupeKey: `event:${ev.id}` } } });
    expect(n.body).toContain('Ayşe Hasta');
    expect(n.externalBody).not.toContain('Ayşe');
  });

  it('abonesi hata veren olay geri bekletilir ve yeniden denenir', async () => {
    const ev = await t.db.outboxEvent.create({ data: { tenantId: stack().demo.id, type: 'sgk.reports.received', payload: { bozuk: true } } });
    await dispatchAll();
    const row = await t.db.outboxEvent.findUniqueOrThrow({ where: { id: ev.id } });
    expect(row.processedAt).toBeNull();
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBeTruthy();
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
    await t.db.outboxEvent.delete({ where: { id: ev.id } });
  });

  it('WhatsApp: rıza veren kullanıcıya kuyruktan gönderilir (mock), kayıt SENT olur', async () => {
    const tenantId = stack().demo.id;
    const user = await t.db.user.update({
      where: { email: stack().demo.staffEmail },
      data: { phone: '905321112233', whatsappEnabled: true, whatsappOptInAt: new Date(), notifyCategories: ['SISTEM'] },
    });
    const ev = await t.db.outboxEvent.create({ data: { tenantId, type: 'billing.license.extended', payload: { planName: 'Pro', expiresAt: new Date().toISOString() } } });
    await dispatchAll();
    const n = await t.db.notification.findUniqueOrThrow({ where: { tenantId_dedupeKey: { tenantId, dedupeKey: `event:${ev.id}` } } });
    const delivery = await until(() => t.db.notificationDelivery.findFirst({ where: { notificationId: n.id, userId: user.id, status: 'SENT' } }));
    expect(delivery.providerMessageId).toMatch(/^demo\./);
  });

  it('günlük hatırlatıcılar her büroyu kendi bağlamında çalıştırır', async () => {
    const { RemindersService } = await import('../src/modules/notifications/application/reminders.service.js');
    const res = await worker.get(RemindersService).runAll();
    expect(res.tenants).toBeGreaterThanOrEqual(2);
  });

  it('kişisel veri dönüşümü: eski düz kayıtları şifreler ve ham veriyi siler', async () => {
    const wp = await t.db.sgkWorkplace.findFirstOrThrow({ where: { company: { tenantId: stack().demo.id } } });
    const legacy = await t.db.sgkReport.create({ data: { workplaceId: wp.id, medulaRaporId: `ESKI-${Date.now()}`, vaka: 3, tckn: makeTckn('400000001'), fullName: 'Eski Kayıt', raw: { TCKIMLIKNO: 'x' } } });
    const { PersonalDataBackfill } = await import('../src/platform/crypto/personal-data.backfill.js');
    const { runAsSystem } = await import('../src/platform/database/tenant-context.js');
    await runAsSystem(() => worker.get(PersonalDataBackfill).run());
    const after = await t.db.sgkReport.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(after).toMatchObject({ tckn: null, fullName: null, raw: null });
    expect(after.tcknEnc).toMatch(/^v[12]:/);
    expect(after.tcknHash).toBeTruthy();
  });
});

describe('worker zamanlanmış yolları', () => {
  it('toplu olay yayını ve işlenmiş olayların temizliği', async () => {
    const { OutboxService } = await import('../src/platform/events/outbox.service.js');
    const { OutboxDispatcher } = await import('../src/platform/events/outbox.dispatcher.js');
    const { runAsSystem } = await import('../src/platform/database/tenant-context.js');
    const outbox = worker.get(OutboxService);
    expect(await runAsSystem(() => outbox.publishAll([]))).toEqual({ count: 0 });
    const r = await runAsSystem(() =>
      outbox.publishAll([1, 2].map((i) => ({ type: 'billing.license.extended', tenantId: stack().B.id, payload: { planName: `P${i}`, expiresAt: new Date().toISOString() } }))),
    );
    expect(r.count).toBe(2);
    const old = await t.db.outboxEvent.create({ data: { tenantId: stack().B.id, type: 'x', payload: {}, processedAt: new Date(Date.now() - 30 * 86_400_000) } });
    const d = worker.get(OutboxDispatcher) as unknown as { tick: () => Promise<void>; lastCleanup: number };
    d.lastCleanup = 0;
    await d.tick();
    expect(await t.db.outboxEvent.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await t.db.outboxEvent.count({ where: { tenantId: stack().B.id, type: 'billing.license.extended', processedAt: null } })).toBe(0);
  });

  it('SGK kuyruk işleyicisi: tümünü sıraya alma ve tek işyeri işleri', async () => {
    const { SgkSyncProcessor } = await import('../src/modules/social-security/infrastructure/sgk-sync.processor.js');
    const p = worker.get(SgkSyncProcessor);
    const all = await p.process({ name: 'sync-all', data: { tenantId: stack().B.id } } as never);
    expect(all).toEqual({ queued: 0 }); // B'nin kurum şifresi girilmiş işyeri yok
    await expect(p.process({ name: 'bilinmeyen', data: {} } as never)).rejects.toThrow(/Bilinmeyen iş/);
  });
});
