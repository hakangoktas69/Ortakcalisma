import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildUblInvoice } from '../src/modules/invoicing/infrastructure/ubl-sample.js';
import { makeTckn } from '../src/shared-kernel/testing/test-tckn.js';
import { type Session, type TestApp, bootApp, expectNoFullTckn, stack } from './support/app.js';

// invoicing (UBL-TR aktarımı, KDV ön kontrol) ve payroll (bordro aktarımı, e-Bildirge mutabakatı) regresyonu.

let t: TestApp;
let admin: Session;
let seller: { id: string; taxNumber: string; title: string };

beforeAll(async () => {
  t = await bootApp();
  admin = await t.login(stack().demo.email, stack().demo.password);
  seller = await t.db.company.findUniqueOrThrow({ where: { id: stack().demo.companyId }, select: { id: true, taxNumber: true, title: true } });
}, 120_000);
afterAll(() => t?.close());

const invoiceXml = (number: string, opts: { vatRate?: number; withholdingRatio?: number } = {}) =>
  buildUblInvoice({
    uuid: randomUUID(),
    number,
    issueDate: '2026-09-15',
    supplier: { taxNumber: seller.taxNumber, name: seller.title },
    customer: { taxNumber: '9990000001', name: 'Dış Müşteri A.Ş.' },
    lines: [{ name: 'Danışmanlık', quantity: 2, unitPrice: 1000, vatRate: opts.vatRate ?? 20 }],
    withholdingRatio: opts.withholdingRatio,
  });

describe('faturalar', () => {
  it('XML aktarımı: önizleme yazmaz, onay yazar, aynı ETTN ikinci kez atlanır', async () => {
    const xml = invoiceXml(`REG2026${Date.now()}`);
    const preview = await t.http().post('/api/invoices/import').set(admin.auth).attach('files', Buffer.from(xml), 'fatura.xml').expect(201);
    expect(preview.body.dryRun).toBe(true);
    const before = await t.db.invoice.count({ where: { companyId: seller.id } });
    const write = await t.http().post('/api/invoices/import').query({ dryRun: 'false' }).set(admin.auth).attach('files', Buffer.from(xml), 'fatura.xml').expect(201);
    expect(write.body.dryRun).toBe(false);
    expect(await t.db.invoice.count({ where: { companyId: seller.id } })).toBe(before + 1);
    await t.http().post('/api/invoices/import').query({ dryRun: 'false' }).set(admin.auth).attach('files', Buffer.from(xml), 'fatura.xml').expect(201);
    expect(await t.db.invoice.count({ where: { companyId: seller.id } })).toBe(before + 1);
  });

  it('ZIP içinden okur; XXE içeren XML\'i genişletmez', async () => {
    const zip = new JSZip();
    zip.file('a.xml', invoiceXml(`ZIP2026${Date.now()}`));
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const res = await t.http().post('/api/invoices/import').set(admin.auth).attach('files', buf, 'faturalar.zip').expect(201);
    expect(res.body.recognized).toBe(1);
    const xxe = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><Invoice>&e;</Invoice>`;
    const bad = await t.http().post('/api/invoices/import').set(admin.auth).attach('files', Buffer.from(xxe), 'xxe.xml');
    expect([201, 400]).toContain(bad.status);
    expect(JSON.stringify(bad.body)).not.toMatch(/root:x:0/);
  });

  it('dosyasız / yanlış türde istek reddedilir', async () => {
    await t.http().post('/api/invoices/import').set(admin.auth).expect(400);
  });

  it('liste filtreleri, KDV ön kontrol ve silme', async () => {
    const list = await t.http().get('/api/invoices').query({ companyId: seller.id, period: '2026-09', direction: 'OUTGOING' }).set(admin.auth).expect(200);
    const items = list.body.items ?? list.body;
    expect(items.length).toBeGreaterThan(0);
    const overview = await t.http().get('/api/invoices/overview').query({ period: '2026-09' }).set(admin.auth).expect(200);
    expect(JSON.stringify(overview.body)).toContain(seller.id);
    const kdv = await t.http().get('/api/invoices/kdv').query({ companyId: seller.id, period: '2026-09' }).set(admin.auth).expect(200);
    expect(kdv.body).toBeTruthy();
    await t.http().get('/api/invoices/kdv').query({ companyId: stack().B.companyId, period: '2026-09' }).set(admin.auth).expect(404);
    await t.http().delete(`/api/invoices/${items[0].id}`).set(admin.auth).expect(200);
    await t.http().delete(`/api/invoices/${items[0].id}`).set(admin.auth).expect(404);
  });
});

describe('bordro', () => {
  async function payrollFile(rows: (string | number)[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bordro');
    ws.addRow(['T.C. Kimlik No', 'Adı Soyadı', 'Gün', 'Brüt Ücret', 'SGK Matrahı', 'SGK İşçi Payı', 'İşsizlik İşçi Payı', 'Gelir Vergisi', 'Damga Vergisi', 'Net Ücret']);
    for (const r of rows) ws.addRow(r);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  const line = (seed: string, base = 30_000) => [makeTckn(seed), `Çalışan ${seed}`, 30, base, base, base * 0.14, base * 0.01, 2000, 200, base - base * 0.15 - 2200];

  it('şablon indirilir', async () => {
    const res = await t.http().get('/api/payroll/template').set(admin.auth).expect(200);
    expect(res.headers['content-disposition']).toMatch(/\.xlsx/);
  });

  it('önizleme → kayıt → detay (şifreli kimlik, maskeli yanıt) → genel bakış → silme', async () => {
    const wp = await t.db.sgkWorkplace.findFirstOrThrow({ where: { companyId: seller.id } });
    const file = await payrollFile([line('300000001'), line('300000002'), [makeTckn('300000001'), 'Tekrar', 30, 1, 1, 1, 1, 0, 0, 0]]);
    const fields = { companyId: seller.id, workplaceId: wp.id, period: '2026-09' };
    const preview = await t.http().post('/api/payroll/import').set(admin.auth).field(fields).attach('file', file, 'bordro.xlsx').expect(201);
    expect(preview.body.dryRun).toBe(true);
    expect(preview.body.errorCount).toBeGreaterThan(0); // aynı kişi iki kez
    expectNoFullTckn(preview.body);

    const ok = await t.http().post('/api/payroll/import').query({ dryRun: 'false' }).set(admin.auth).field(fields).attach('file', await payrollFile([line('300000001'), line('300000002')]), 'bordro.xlsx').expect(201);
    expect(ok.body.runId).toBeTruthy();
    const stored = await t.db.payrollLine.findMany({ where: { runId: ok.body.runId } });
    expect(stored.every((l) => l.tckn === null && l.tcknEnc?.startsWith('v'))).toBe(true);

    const detail = await t.http().get(`/api/payroll/runs/${ok.body.runId}`).set(admin.auth).expect(200);
    expect(detail.body.lines).toHaveLength(2);
    expectNoFullTckn(detail.body);
    expect(detail.body.lines.map((l: { fullName: string }) => l.fullName)).toEqual(['Çalışan 300000001', 'Çalışan 300000002']);

    const overview = await t.http().get('/api/payroll/overview').query({ period: '2026-09' }).set(admin.auth).expect(200);
    expect(JSON.stringify(overview.body)).toContain(ok.body.runId);

    await t.http().delete(`/api/payroll/runs/${ok.body.runId}`).set(admin.auth).expect(200);
    await t.http().get(`/api/payroll/runs/${ok.body.runId}`).set(admin.auth).expect(404);
  });

  it('geçersiz dönem, başka büronun firması, başlıksız dosya', async () => {
    const file = await payrollFile([line('300000003')]);
    await t.http().post('/api/payroll/import').set(admin.auth).field({ companyId: seller.id, period: '2026/09' }).attach('file', file, 'b.xlsx').expect(400);
    await t.http().post('/api/payroll/import').set(admin.auth).field({ companyId: stack().B.companyId, period: '2026-09' }).attach('file', file, 'b.xlsx').expect(404);
    await t.http().post('/api/payroll/import').set(admin.auth).field({ companyId: seller.id, period: '2026-09' }).attach('file', Buffer.from('a;b\n1;2\n'), 'b.csv').expect(400);
  });
});
