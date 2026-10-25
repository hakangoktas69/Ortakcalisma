import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Session, type TestApp, bootApp, stack } from './support/app.js';

// taxpayers (mükellef kartı, Excel/CSV aktarımı) ve tax-filing (yükümlülük, beyanname kontrolü, e-Defter) regresyonu.

let t: TestApp;
let admin: Session;
let staff: Session;
let vknSeq = 0;
const uniqueVkn = () => String(9_000_000_000 + Date.now() % 100_000_000 + vknSeq++).slice(0, 10);

beforeAll(async () => {
  t = await bootApp();
  admin = await t.login(stack().demo.email, stack().demo.password);
  staff = await t.login(stack().demo.staffEmail, stack().demo.staffPassword);
}, 120_000);
afterAll(() => t?.close());

describe('mükellefler (companies)', () => {
  it('liste: unvana göre sıralı, arama ve tür filtresi', async () => {
    const all = await t.http().get('/api/companies').set(admin.auth).expect(200);
    expect(all.body.length).toBeGreaterThan(10);
    const titles = all.body.map((c: { title: string }) => c.title);
    expect([...titles].sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(titles);
    const one = all.body[0];
    const q = await t.http().get('/api/companies').query({ q: one.taxNumber }).set(admin.auth).expect(200);
    expect(q.body.map((c: { id: string }) => c.id)).toContain(one.id);
    const sahis = await t.http().get('/api/companies').query({ type: 'SAHIS' }).set(admin.auth).expect(200);
    expect(sahis.body.every((c: { type: string }) => c.type === 'SAHIS')).toBe(true);
  });

  it('ekleme, doğrulama, aynı VKN çakışması, güncelleme, pasifleştirme', async () => {
    const vkn = uniqueVkn();
    const created = await t.http().post('/api/companies').set(admin.auth).send({ title: 'Regresyon A.Ş.', taxNumber: vkn, type: 'SIRKET', email: 'info@regresyon.test' }).expect(201);
    expect(created.body).toMatchObject({ title: 'Regresyon A.Ş.', taxNumber: vkn, isActive: true });
    await t.http().post('/api/companies').set(admin.auth).send({ title: 'X', taxNumber: '123', type: 'SIRKET' }).expect(400);
    await t.http().post('/api/companies').set(admin.auth).send({ title: 'Kopya', taxNumber: vkn, type: 'SIRKET' }).expect(409);
    const up = await t.http().patch(`/api/companies/${created.body.id}`).set(staff.auth).send({ phone: '02120000000', isActive: false }).expect(200);
    expect(up.body).toMatchObject({ phone: '02120000000', isActive: false });
    await t.http().patch('/api/companies/olmayan').set(admin.auth).send({ phone: '1' }).expect(404);
  });

  it('kota dolunca ve lisans bitince ekleme reddedilir', async () => {
    const sub = await t.db.subscription.findUniqueOrThrow({ where: { tenantId: stack().demo.id } });
    const used = await t.db.company.count({ where: { tenantId: stack().demo.id } });
    try {
      await t.db.subscription.update({ where: { id: sub.id }, data: { companyQuota: used } });
      const full = await t.http().post('/api/companies').set(admin.auth).send({ title: 'Fazla', taxNumber: uniqueVkn(), type: 'SIRKET' }).expect(403);
      expect(full.body.message).toMatch(/kota/i);
      await t.db.subscription.update({ where: { id: sub.id }, data: { companyQuota: sub.companyQuota, expiresAt: new Date(Date.now() - 1000) } });
      await t.http().post('/api/companies').set(admin.auth).send({ title: 'Süresi geçmiş', taxNumber: uniqueVkn(), type: 'SIRKET' }).expect(403);
    } finally {
      await t.db.subscription.update({ where: { id: sub.id }, data: { companyQuota: sub.companyQuota, expiresAt: sub.expiresAt } });
    }
  });

  it('Excel şablonu indirilir ve geçerli bir .xlsx\'tir', async () => {
    const res = await t.http().get('/api/companies/import/template').set(admin.auth).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(res.headers['content-disposition']).toMatch(/\.xlsx/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
    expect(wb.worksheets[0].getRow(1).values).toContain('VKN / TCKN');
  });

  it('CSV aktarımı: önizleme yazmaz, onay yazar; hatalı satırlar raporlanır; yalnız yönetici', async () => {
    const vkn = uniqueVkn();
    const csv = `Unvan;VKN;Tür;E-posta\nCSV Firması Ltd.;${vkn};Şirket;csv@firma.test\nHatalı Satır;12;Şirket;\n`;
    const preview = await t.http().post('/api/companies/import').set(admin.auth).attach('file', Buffer.from(csv), 'firmalar.csv').expect(201);
    expect(preview.body).toMatchObject({ dryRun: true, create: 1, error: 1 });
    expect(await t.db.company.count({ where: { taxNumber: vkn } })).toBe(0);
    const write = await t.http().post('/api/companies/import').query({ dryRun: 'false' }).set(admin.auth).attach('file', Buffer.from(csv), 'firmalar.csv').expect(201);
    expect(write.body).toMatchObject({ dryRun: false, create: 1 });
    expect(await t.db.company.count({ where: { taxNumber: vkn, tenantId: stack().demo.id } })).toBe(1);
    const again = await t.http().post('/api/companies/import').set(admin.auth).attach('file', Buffer.from(csv), 'firmalar.csv').expect(201);
    expect(again.body.update).toBe(1);
    await t.http().post('/api/companies/import').set(staff.auth).attach('file', Buffer.from(csv), 'firmalar.csv').expect(403);
    await t.http().post('/api/companies/import').set(admin.auth).attach('file', Buffer.from('x'), 'firmalar.pdf').expect(400);
    await t.http().post('/api/companies/import').set(admin.auth).attach('file', Buffer.from('bozuk'), 'firmalar.xlsx').expect(400);
  });
});

describe('beyanname yükümlülükleri ve kontrol', () => {
  it('yükümlülükler okunur ve güncellenir', async () => {
    const id = stack().demo.companyId;
    const before = await t.http().get(`/api/companies/${id}/obligations`).set(admin.auth).expect(200);
    expect(before.body.items).toHaveLength(6);
    const set = await t.http().put(`/api/companies/${id}/obligations`).set(admin.auth).send({ active: ['KDV1', 'MUHSGK'] }).expect(200);
    expect(set.body.items.filter((i: { active: boolean }) => i.active).map((i: { type: string }) => i.type)).toEqual(['KDV1', 'MUHSGK']);
    await t.http().put(`/api/companies/${id}/obligations`).set(admin.auth).send({ active: ['YOK'] }).expect(400);
    await t.http().put(`/api/companies/${id}/obligations`).set(admin.auth).send({ active: before.body.items.filter((i: { active: boolean }) => i.active).map((i: { type: string }) => i.type) }).expect(200);
    await t.http().get('/api/companies/olmayan/obligations').set(admin.auth).expect(404);
  });

  it('kontrol matrisi: dönem, türler ve her hücrede durum', async () => {
    const res = await t.http().get('/api/declarations/control').query({ month: '2026-08' }).set(admin.auth).expect(200);
    expect(res.body).toMatchObject({ year: 2026, month: 8 });
    expect(res.body.types.length).toBeGreaterThan(0);
    for (const row of res.body.rows) {
      for (const cell of row.cells) expect(['FILED', 'FILED_LATE', 'PENDING', 'LATE']).toContain(cell.status);
    }
    await t.http().get('/api/declarations/control').query({ month: 'bozuk' }).set(admin.auth).expect((r) => expect([200, 400]).toContain(r.status));
  });

  it('elle verildi işareti → kontrol matrisinde görünür → geri alma', async () => {
    const control = await t.http().get('/api/declarations/control').query({ month: '2026-08' }).set(admin.auth).expect(200);
    const row = control.body.rows.find((r: { cells: { declaration: unknown }[] }) => r.cells.some((c) => !c.declaration));
    const cell = row.cells.find((c: { declaration: unknown }) => !c.declaration);
    const mark = await t.http().post('/api/declarations').set(admin.auth).send({ companyId: row.company.id, type: cell.type, period: cell.period, accrualAmount: 1250.5 }).expect(201);
    expect(mark.body.source).toBe('MANUAL');
    const after = await t.http().get('/api/declarations/control').query({ month: '2026-08' }).set(admin.auth).expect(200);
    const same = after.body.rows.find((r: { company: { id: string } }) => r.company.id === row.company.id).cells.find((c: { type: string; period: string }) => c.type === cell.type && c.period === cell.period);
    expect(same.declaration.accrualAmount).toBe(1250.5);
    expect(['FILED', 'FILED_LATE']).toContain(same.status);
    await t.http().delete(`/api/declarations/${mark.body.id}`).set(admin.auth).expect(200);
    await t.http().delete(`/api/declarations/${mark.body.id}`).set(admin.auth).expect(404);
    await t.http().post('/api/declarations').set(admin.auth).send({ companyId: row.company.id, type: 'KDV1', period: '09-2026' }).expect(400);
    await t.http().post('/api/declarations').set(admin.auth).send({ companyId: stack().B.companyId, type: 'KDV1', period: '2026-08' }).expect(404);
  });

  it('GİB demo senkronu kayıt üretir, tekrar çalıştırmak çoğaltmaz', async () => {
    const first = await t.http().post('/api/declarations/sync').query({ month: '2026-07' }).set(admin.auth).expect(201);
    expect(first.body.fetched).toBeGreaterThanOrEqual(0);
    const second = await t.http().post('/api/declarations/sync').query({ month: '2026-07' }).set(admin.auth).expect(201);
    expect(second.body.created).toBe(0);
  });
});

describe('e-Defter', () => {
  it('firma ayarı → kontrol listesi → berat yüklendi / elle son gün / geri alma', async () => {
    const id = stack().demo.companyId;
    await t.http().put(`/api/edefter/companies/${id}`).set(admin.auth).send({ enabled: true, preference: 'MONTHLY' }).expect(200);
    const companies = await t.http().get('/api/edefter/companies').set(admin.auth).expect(200);
    expect(JSON.stringify(companies.body)).toContain(id);

    const control = await t.http().get('/api/edefter/control').query({ month: '2026-07' }).set(admin.auth).expect(200);
    expect(control.body).toMatchObject({ year: 2026, month: 7 });
    const row = control.body.rows.find((r: { company: { id: string } }) => r.company.id === id);
    expect(row).toBeTruthy();

    await t.http().put(`/api/edefter/companies/${id}/berats/${row.period}`).set(admin.auth).send({ uploadedAt: '2026-07-05T10:00:00.000Z', note: 'yüklendi' }).expect(200);
    const after = await t.http().get('/api/edefter/control').query({ month: '2026-07' }).set(admin.auth).expect(200);
    expect(after.body.rows.find((r: { company: { id: string } }) => r.company.id === id).uploadedAt).toBeTruthy();
    await t.http().put(`/api/edefter/companies/${id}/berats/${row.period}`).set(admin.auth).send({ uploadedAt: null, dueDateOverride: '2026-12-31T00:00:00.000Z' }).expect(200);
    const over = await t.http().get('/api/edefter/control').query({ month: '2026-07' }).set(admin.auth).expect(200);
    expect(over.body.rows.find((r: { company: { id: string } }) => r.company.id === id).dueDateSource).toBe('override');

    await t.http().put(`/api/edefter/companies/${id}/berats/2026-13x`).set(admin.auth).send({}).expect(400);
    await t.http().put(`/api/edefter/companies/${stack().B.companyId}/berats/2026-07`).set(admin.auth).send({ note: 'x' }).expect(404);
    await t.http().put(`/api/edefter/companies/${id}`).set(admin.auth).send({ enabled: true, preference: 'YILLIK' }).expect(400);
  });

  it('varsayılan ay parametresiz çalışır', async () => {
    const res = await t.http().get('/api/edefter/control').set(admin.auth).expect(200);
    expect(res.body.counts).toBeTruthy();
  });
});
