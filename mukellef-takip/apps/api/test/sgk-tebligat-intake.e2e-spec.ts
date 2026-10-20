import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTckn } from '../src/shared-kernel/testing/test-tckn.js';
import { type Session, type TestApp, bootApp, expectNoFullTckn, stack } from './support/app.js';

// social-security (işyeri, kurum şifreleri, Vizite e-rapor, 4A, e-Bildirge), tebligat ve data-intake (eklenti aktarımı) regresyonu.

let t: TestApp;
let admin: Session;
let workplaceId: string;

beforeAll(async () => {
  t = await bootApp();
  admin = await t.login(stack().demo.email, stack().demo.password);
}, 120_000);
afterAll(() => t?.close());

describe('SGK işyerleri ve kurum şifreleri', () => {
  it('işyeri listesi şifre döndürmez; yeni işyeri eklenir', async () => {
    const list = await t.http().get('/api/sgk/workplaces').set(admin.auth).expect(200);
    expect(list.body).toMatchObject({ mode: 'mock' });
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(list.body)).not.toMatch(/SecretEnc|PasswordEnc|"v1:|"v2:/);
    const created = await t.http().post('/api/sgk/workplaces').set(admin.auth).send({ companyId: stack().demo.companyId, registryNo: '2 1111 01 01 1234567 034 12 34 000', name: 'Test işyeri' }).expect(201);
    workplaceId = created.body.id;
    await t.http().post('/api/sgk/workplaces').set(admin.auth).send({ companyId: stack().B.companyId, registryNo: '12345' }).expect(404);
    await t.http().post('/api/sgk/workplaces').set(admin.auth).send({ companyId: stack().demo.companyId, registryNo: 'abc' }).expect(400);
  });

  it('Vizite bilgileri: hatalı giriş reddedilir; doğruysa şifreli saklanır ve denetim kaydına yazılır', async () => {
    await t.http().put(`/api/sgk/workplaces/${workplaceId}/vizite-credentials`).set(admin.auth).send({ username: '10000000146', workplaceCode: '1234', password: 'hatali' }).expect(400);
    await t.http().put(`/api/sgk/workplaces/${workplaceId}/vizite-credentials`).set(admin.auth).send({ username: '1', workplaceCode: '1234', password: 'x' }).expect(400);
    await t.http().put(`/api/sgk/workplaces/${workplaceId}/vizite-credentials`).set(admin.auth).send({ username: '10000000146', workplaceCode: '1234', password: 'gizli-sgk' }).expect(200);
    const wp = await t.db.sgkWorkplace.findUniqueOrThrow({ where: { id: workplaceId } });
    expect(wp.viziteSecretEnc).toMatch(/^v[12]:/);
    expect(wp.viziteSecretEnc).not.toContain('gizli-sgk');
    expect(await t.db.auditLog.count({ where: { action: 'vizite.credentials.update', target: workplaceId } })).toBe(1);
  });

  it('4A bilgileri: iki şifre ayrı ayrı şifrelenir; silme', async () => {
    await t.http().put(`/api/sgk/workplaces/${workplaceId}/tescil-credentials`).set(admin.auth).send({ username: 'kullanici', systemPassword: 'hatali', workplacePassword: 'x' }).expect(400);
    await t.http().put(`/api/sgk/workplaces/${workplaceId}/tescil-credentials`).set(admin.auth).send({ username: 'kullanici', systemPassword: 'sistem-1', workplacePassword: 'isyeri-1' }).expect(200);
    const wp = await t.db.sgkWorkplace.findUniqueOrThrow({ where: { id: workplaceId } });
    expect(wp.tescilSystemPasswordEnc).toMatch(/^v[12]:/);
    expect(wp.tescilWorkplacePasswordEnc).not.toBe(wp.tescilSystemPasswordEnc);
  });

  it('senkron: e-raporlar ve işe giriş/çıkış şifreli yazılır, yanıtlarda T.C. maskeli', async () => {
    const sync = await t.http().post('/api/sgk/sync').query({ workplaceId }).set(admin.auth).expect(201);
    expect(sync.body.result.error).toBeUndefined();
    const reports = await t.http().get('/api/sgk/reports').set(admin.auth).expect(200);
    expect(reports.body.length).toBeGreaterThan(0);
    expectNoFullTckn(reports.body);
    expect(reports.body[0].fullName).toBeTruthy();
    const raw = await t.db.sgkReport.findFirstOrThrow({ where: { workplaceId } });
    expect(raw.tckn).toBeNull();
    expect(raw.tcknEnc).toMatch(/^v[12]:/);
    expect(raw.raw).toBeNull();
    const pending = await t.http().get('/api/sgk/reports').query({ status: 'PENDING' }).set(admin.auth).expect(200);
    expect(pending.body.every((r: { status: string }) => r.status === 'PENDING')).toBe(true);

    const emp = await t.http().get('/api/sgk/employment').query({ days: 400 }).set(admin.auth).expect(200);
    expectNoFullTckn(emp.body);
    const entries = await t.http().get('/api/sgk/employment').query({ type: 'ENTRY', days: 400 }).set(admin.auth).expect(200);
    expect(entries.body.every((e: { type: string }) => e.type === 'ENTRY')).toBe(true);
    expect(await t.db.auditLog.count({ where: { action: 'pii.read', target: 'sgk.reports' } })).toBeGreaterThan(0);
  });

  it('çalışmazlık onayı: şifreli T.C. çözülüp SGK\'ya gönderilir; tekrar onay değişiklik yapmaz', async () => {
    const report = await t.db.sgkReport.findFirstOrThrow({ where: { workplaceId, status: 'PENDING' } });
    await t.http().post(`/api/sgk/reports/${report.id}/approve`).set(admin.auth).send({ nitelikDurumu: '1', tarih: 'bozuk' }).expect(400);
    const ok = await t.http().post(`/api/sgk/reports/${report.id}/approve`).set(admin.auth).send({ nitelikDurumu: '1', tarih: '20.10.2026' }).expect(201);
    expect(ok.body.status).toBe('APPROVED');
    await t.http().post(`/api/sgk/reports/${report.id}/approve`).set(admin.auth).send({ nitelikDurumu: '1', tarih: '20.10.2026' }).expect(201);
    expect(await t.db.auditLog.count({ where: { action: 'vizite.report.approve', target: report.id } })).toBe(1);
  });

  it('tüm işyerlerini kuyruğa alma', async () => {
    const res = await t.http().post('/api/sgk/sync').set(admin.auth).expect(201);
    expect(res.body.queued).toBeGreaterThan(0);
  });

  it('kurum şifresi silme', async () => {
    await t.http().delete(`/api/sgk/workplaces/${workplaceId}/vizite-credentials`).set(admin.auth).expect(200);
    await t.http().delete(`/api/sgk/workplaces/${workplaceId}/tescil-credentials`).set(admin.auth).expect(200);
    const wp = await t.db.sgkWorkplace.findUniqueOrThrow({ where: { id: workplaceId } });
    expect(wp.viziteSecretEnc).toBeNull();
    expect(wp.tescilSystemPasswordEnc).toBeNull();
    await t.http().delete('/api/sgk/workplaces/olmayan/vizite-credentials').set(admin.auth).expect(404);
  });
});

describe('eklenti aktarımı (data-intake) ve e-Tebligat', () => {
  const company = async () => t.db.company.findUniqueOrThrow({ where: { id: stack().demo.companyId } });

  it('yalnız GİB/SGK alan adlarından kabul edilir', async () => {
    await t.http().post('/api/import/page').set(admin.auth).send({ pageUrl: 'https://kotu-site.example/gib.gov.tr', tables: [] }).expect(400);
    await t.http().post('/api/import/page').set(admin.auth).send({ pageUrl: 'https://intvrg.gib.gov.tr/x', tables: [], fazla: true }).expect(400);
  });

  it('tebligat: önizleme yazmaz, onay yazar ve olay üretir; tekrar aktarım kopya üretmez', async () => {
    const c = await company();
    const subject = `Regresyon ihbarnamesi ${Date.now()}`;
    const body = { pageUrl: 'https://dijital.gib.gov.tr/etebligat', taxNumber: c.taxNumber, tables: [{ headers: ['Gönderen', 'Konu', 'Tarih'], rows: [['Kadıköy Vergi Dairesi', subject, '15.10.2026']] }] };
    const preview = await t.http().post('/api/import/page').set(admin.auth).send(body).expect(201);
    expect(preview.body.dryRun).toBe(true);
    expect(preview.body.tebligat.create).toBe(1);
    expect(await t.db.eTebligat.count({ where: { subject } })).toBe(0);

    const write = await t.http().post('/api/import/page').set(admin.auth).send({ ...body, dryRun: false }).expect(201);
    expect(write.body.tebligat.create).toBe(1);
    const row = await t.db.eTebligat.findFirstOrThrow({ where: { subject } });
    // Tebliğ sayılma: ulaşmayı izleyen 5. günün sonu (VUK 107/A)
    expect(row.deemedServedAt.getTime()).toBeGreaterThan(row.deliveredAt.getTime() + 4 * 86_400_000);
    expect(await t.db.outboxEvent.count({ where: { type: 'tebligat.imported', tenantId: stack().demo.id, processedAt: null } })).toBeGreaterThan(0);

    const again = await t.http().post('/api/import/page').set(admin.auth).send({ ...body, dryRun: false }).expect(201);
    expect(again.body.tebligat.create).toBe(0);
    expect(await t.db.eTebligat.count({ where: { subject } })).toBe(1);
  });

  it('tebligat listesi, özet, incelendi işareti', async () => {
    const open = await t.http().get('/api/tebligat').query({ status: 'open', days: 365 }).set(admin.auth).expect(200);
    expect(open.body.length).toBeGreaterThan(0);
    const summary = await t.http().get('/api/tebligat/summary').set(admin.auth).expect(200);
    expect(summary.body).toBeTruthy();
    const id = open.body[0].id;
    await t.http().put(`/api/tebligat/${id}/review`).set(admin.auth).send({ reviewed: true }).expect(200);
    const after = await t.http().get('/api/tebligat').query({ status: 'open', days: 365 }).set(admin.auth).expect(200);
    expect(after.body.map((x: { id: string }) => x.id)).not.toContain(id);
    await t.http().put(`/api/tebligat/${id}/review`).set(admin.auth).send({ reviewed: false }).expect(200);
    await t.http().get('/api/tebligat').query({ q: 'olmayan-firma-zzz' }).set(admin.auth).expect(200).expect((r) => expect(r.body).toEqual([]));
    await t.http().put('/api/tebligat/olmayan/review').set(admin.auth).send({ reviewed: true }).expect(404);
  });

  it('beyanname tablosu aktarımı elle girileni GİB kaydıyla değiştirir', async () => {
    const c = await company();
    const body = {
      pageUrl: 'https://ebeyanname.gib.gov.tr/liste',
      dryRun: false,
      tables: [{ headers: ['Vergi Kimlik No', 'Beyanname Türü', 'Dönem', 'Onay Zamanı'], rows: [[c.taxNumber, 'KDV1', '06/2026', '20.07.2026 10:00']] }],
    };
    await t.http().post('/api/declarations').set(admin.auth).send({ companyId: c.id, type: 'KDV1', period: '2026-06' }).expect(201);
    const res = await t.http().post('/api/import/page').set(admin.auth).send(body).expect(201);
    expect(res.body.declarations.replaceManual + res.body.declarations.create + (res.body.declarations.complete ?? 0)).toBeGreaterThan(0);
    const d = await t.db.declaration.findFirstOrThrow({ where: { companyId: c.id, type: 'KDV1', period: '2026-06' } });
    expect(d.source).toBe('EXTENSION');
  });

  it('e-Bildirge aktarımı işyerine eşleşir; eşleşmezse sicil no sorar', async () => {
    const wp = await t.db.sgkWorkplace.findFirstOrThrow({ where: { company: { tenantId: stack().demo.id } } });
    const table = { headers: ['Dönem', 'Belge Türü', 'Kanun No', 'Mahiyet', 'Sigortalı Sayısı', 'Prim Ödeme Gün Sayısı', 'Prime Esas Kazanç', 'Prim Tutarı', 'Onay Tarihi'], rows: [['2026/05', '1', '5510', 'Asıl', '3', '90', '99.000,00', '20.000,00', '20.06.2026']] };
    const noMatch = await t.http().post('/api/import/page').set(admin.auth).send({ pageUrl: 'https://ebildirge.sgk.gov.tr/x', tables: [table] }).expect(201);
    expect(noMatch.body.ebildirge.create ?? 0).toBe(0);
    const ok = await t.http().post('/api/import/page').set(admin.auth).send({ pageUrl: 'https://ebildirge.sgk.gov.tr/x', tables: [table], registryNo: wp.registryNo, dryRun: false }).expect(201);
    expect(ok.body.ebildirge).toMatchObject({ create: 1, needsWorkplace: false });
    expect(ok.body.ebildirge.workplace.id).toBe(wp.id);
    expect(noMatch.body.ebildirge.needsWorkplace).toBe(true);
    // Aynı belge tekrar: değişmedi; tutar değişince güncellenir; sayfa metnindeki sicil ipucuyla da eşleşir
    const same = await t.http().post('/api/import/page').set(admin.auth).send({ pageUrl: 'https://ebildirge.sgk.gov.tr/x', tables: [table], pageRegistryHints: [wp.registryNo], dryRun: false }).expect(201);
    expect(same.body.ebildirge).toMatchObject({ unchanged: 1, create: 0 });
    const changed = { ...table, rows: [[...table.rows[0].slice(0, 4), '4', ...table.rows[0].slice(5)]] };
    const upd = await t.http().post('/api/import/page').set(admin.auth).send({ pageUrl: 'https://ebildirge.sgk.gov.tr/x', tables: [changed], registryNo: wp.registryNo, dryRun: false }).expect(201);
    expect(upd.body.ebildirge.update).toBe(1);
    const wrong = await t.http().post('/api/import/page').set(admin.auth).send({ pageUrl: 'https://ebildirge.sgk.gov.tr/x', tables: [table], registryNo: '99999999999999999999' }).expect(201);
    expect(wrong.body.ebildirge.unmatchedRegistries).toContain('99999999999999999999');
    const list = await t.http().get('/api/sgk/ebildirge').query({ months: 24 }).set(admin.auth).expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    for (const d of list.body) expect(d.premiumBase === null || typeof d.premiumBase === 'number').toBe(true);
  });

  it('başka büronun mükellefi için tebligat yazılamaz', async () => {
    const b = await t.db.company.findUniqueOrThrow({ where: { id: stack().B.companyId } });
    const res = await t.http().post('/api/import/page').set(admin.auth).send({ pageUrl: 'https://dijital.gib.gov.tr/x', dryRun: false, taxNumber: b.taxNumber, tables: [{ headers: ['Gönderen', 'Konu', 'Tarih'], rows: [['VD', 'Sızma denemesi', '15.10.2026']] }] }).expect(201);
    expect(res.body.tebligat.create).toBe(0);
    expect(await t.db.eTebligat.count({ where: { subject: 'Sızma denemesi' } })).toBe(0);
  });
});

it('test T.C. üreticisi geçerli numara üretir (fixture sağlaması)', () => {
  expect(makeTckn('100000001')).toMatch(/^\d{11}$/);
});
