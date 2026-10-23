import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Session, type TestApp, bootApp, stack } from './support/app.js';

// billing (lisans, ödeme), documents (dilekçe) ve assistant (Uzmana Sor) regresyonu.

let t: TestApp;
let admin: Session;
let staff: Session;

beforeAll(async () => {
  t = await bootApp();
  admin = await t.login(stack().demo.email, stack().demo.password);
  staff = await t.login(stack().demo.staffEmail, stack().demo.staffPassword);
}, 120_000);
afterAll(() => t?.close());

describe('lisans ve ödeme (demo sağlayıcı)', () => {
  const profile = {
    billingName: 'Demo Müşavirlik',
    billingContactName: 'Demo Yönetici',
    billingTaxNumber: '1234567890',
    billingTaxOffice: 'Kadıköy',
    billingAddress: 'Moda Cad. No:1 Kadıköy',
    billingCity: 'İstanbul',
    billingEmail: 'fatura@demo.test',
    billingPhone: '+905321234567',
  };

  it('durum, paketler ve fatura profili', async () => {
    const res = await t.http().get('/api/billing').set(admin.auth).expect(200);
    expect(res.body).toMatchObject({ provider: 'demo' });
    expect(res.body.subscription.companyQuota).toBeGreaterThan(0);
    await t.http().put('/api/billing/profile').set(admin.auth).send({ ...profile, billingEmail: 'gecersiz' }).expect(400);
    const p = await t.http().put('/api/billing/profile').set(admin.auth).send(profile).expect(200);
    expect(p.body.complete).toBe(true);
    const g = await t.http().get('/api/billing/profile').set(admin.auth).expect(200);
    expect(g.body.billingCity).toBe('İstanbul');
    await t.http().get('/api/billing/profile').set(staff.auth).expect(403);
  });

  it('ödeme: tutar sunucuda hesaplanır, onay lisansı uzatır ve olay yazar; ikinci onay uzatmaz', async () => {
    const before = await t.db.subscription.findUniqueOrThrow({ where: { tenantId: stack().demo.id } });
    await t.http().post('/api/billing/checkout').set(admin.auth).send({ plan: 'pro', months: 5 }).expect(400);
    await t.http().post('/api/billing/checkout').set(admin.auth).send({ plan: 'yok', months: 12 }).expect(400);
    await t.http().post('/api/billing/checkout').set(admin.auth).send({ plan: 'pro', months: 12, amount: 1 }).expect(400);
    const co = await t.http().post('/api/billing/checkout').set(admin.auth).send({ plan: 'pro', months: 12 }).expect(201);
    expect(co.body.amount).toBeGreaterThan(0);
    await t.http().post(`/api/billing/payments/${co.body.id}/demo-confirm`).set(staff.auth).expect(403);
    await t.http().post(`/api/billing/payments/${co.body.id}/demo-confirm`).set(admin.auth).expect(201);
    const after = await t.db.subscription.findUniqueOrThrow({ where: { tenantId: stack().demo.id } });
    expect(after.expiresAt.getTime()).toBeGreaterThan(before.expiresAt.getTime());
    expect(await t.db.outboxEvent.count({ where: { type: 'billing.license.extended', tenantId: stack().demo.id } })).toBeGreaterThan(0);
    await t.http().post(`/api/billing/payments/${co.body.id}/demo-confirm`).set(admin.auth).expect((r) => expect([200, 201, 400]).toContain(r.status));
    const again = await t.db.subscription.findUniqueOrThrow({ where: { tenantId: stack().demo.id } });
    expect(again.expiresAt.getTime()).toBe(after.expiresAt.getTime());
  });

  it('bekleyen ödeme iptal; iyzico olmayan ödeme yenilenemez', async () => {
    const co = await t.http().post('/api/billing/checkout').set(admin.auth).send({ plan: 'baslangic', months: 1 }).expect((r) => expect([201, 400]).toContain(r.status));
    if (co.status !== 201) return; // mevcut firma sayısını karşılamayan paket seçilemez
    await t.http().post(`/api/billing/payments/${co.body.id}/refresh`).set(admin.auth).expect(400);
    await t.http().post(`/api/billing/payments/${co.body.id}/cancel`).set(admin.auth).expect(201);
    await t.http().post(`/api/billing/payments/${co.body.id}/cancel`).set(admin.auth).expect(404);
  });

  it('iyzico geri dönüşü oturumsuzdur ve bilinmeyen token\'la hiçbir şey onaylamaz', async () => {
    const res = await t.http().post('/api/billing/iyzico/callback').type('form').send({ token: 'bilinmeyen-token-123' }).expect(303);
    expect(res.headers.location).toMatch(/odeme=bilinmiyor/);
    const bad = await t.http().post('/api/billing/iyzico/callback').type('form').send({ token: '<script>' }).expect(303);
    expect(bad.headers.location).toMatch(/odeme=bilinmiyor/);
  });
});

describe('dilekçeler', () => {
  it('hazır şablonlar + büro şablonu ekle / düzenle / sil; sistem şablonu değiştirilemez', async () => {
    const list = await t.http().get('/api/petitions/templates').set(admin.auth).expect(200);
    expect(list.body.length).toBeGreaterThanOrEqual(6);
    const system = list.body.find((x: { tenantId: string | null; isSystem?: boolean }) => x.tenantId === null || x.isSystem);
    const created = await t.http().post('/api/petitions/templates').set(admin.auth).send({ title: 'Regresyon şablonu', category: 'Genel', body: 'Sayın {{daire}}, {{firma_unvani}} adına başvuru.' }).expect(201);
    await t.http().put(`/api/petitions/templates/${created.body.id}`).set(admin.auth).send({ title: 'Düzenlendi', category: 'SGK', body: 'Yeni metin {{firma_unvani}} için.' }).expect(200);
    if (system) await t.http().put(`/api/petitions/templates/${system.id}`).set(admin.auth).send({ title: 'x', category: 'Genel', body: 'değiştirme denemesi' }).expect((r) => expect([403, 404]).toContain(r.status));
    await t.http().post('/api/petitions/templates').set(admin.auth).send({ title: 'x', category: 'Bilinmeyen', body: '0123456789' }).expect(400);

    const prepared = await t.http().post('/api/petitions/prepare').set(admin.auth).send({ templateId: created.body.id, companyId: stack().demo.companyId }).expect(201);
    const company = await t.db.company.findUniqueOrThrow({ where: { id: stack().demo.companyId } });
    expect(prepared.body.fields.find((f: { key: string }) => f.key === 'firma_unvani')).toMatchObject({ auto: true, value: company.title });
    await t.http().post('/api/petitions/prepare').set(admin.auth).send({ templateId: created.body.id, companyId: stack().B.companyId }).expect(404);

    const saved = await t.http().post('/api/petitions').set(admin.auth).send({ companyId: stack().demo.companyId, templateId: created.body.id, title: 'Arşiv dilekçesi', content: 'Dilekçe metni burada yer alır.' }).expect(201);
    const archive = await t.http().get('/api/petitions').query({ companyId: stack().demo.companyId }).set(admin.auth).expect(200);
    expect(archive.body.map((p: { id: string }) => p.id)).toContain(saved.body.id);
    await t.http().get(`/api/petitions/${saved.body.id}`).set(admin.auth).expect(200);
    await t.http().delete(`/api/petitions/${saved.body.id}`).set(admin.auth).expect(200);
    await t.http().get(`/api/petitions/${saved.body.id}`).set(admin.auth).expect(404);
    await t.http().delete(`/api/petitions/templates/${created.body.id}`).set(admin.auth).expect(200);
  });
});

describe('Uzmana Sor (asistan, demo sağlayıcı)', () => {
  it('durum, kişisel veri maskeleme, akış, sohbet geçmişi ve silme', async () => {
    const status = await t.http().get('/api/assistant/status').set(admin.auth).expect(200);
    expect(status.body).toMatchObject({ enabled: true, mode: 'mock' });
    expect(status.body.consent.required).toBe(false);

    const res = await t.http().post('/api/assistant/ask').set(admin.auth).send({ message: 'KDV ne zaman verilir? TCKN 10000000146' }).buffer(true).parse((r, cb) => {
      let s = '';
      r.on('data', (c: Buffer) => (s += c.toString()));
      r.on('end', () => cb(null, s));
    }).expect(200);
    const text = res.body as string;
    expect(text).toMatch(/event: meta/);
    expect(text).toMatch(/event: done/);

    const convs = await t.http().get('/api/assistant/conversations').set(admin.auth).expect(200);
    const conv = await t.http().get(`/api/assistant/conversations/${convs.body[0].id}`).set(admin.auth).expect(200);
    const userMsg = conv.body.messages.find((m: { role: string }) => m.role === 'USER');
    expect(userMsg.content).not.toContain('10000000146');
    expect(userMsg.redactions).toMatchObject({ tckn: 1 });
    // Sohbet yalnız sahibine görünür
    await t.http().get(`/api/assistant/conversations/${convs.body[0].id}`).set(staff.auth).expect(404);
    await t.http().delete(`/api/assistant/conversations/${convs.body[0].id}`).set(admin.auth).expect(200);
    await t.http().post('/api/assistant/ask').set(admin.auth).send({ message: 'x' }).expect(400);
  });

  it('yurt dışı aktarım onayı: yalnız yönetici verir / geri alır', async () => {
    await t.http().put('/api/assistant/consent').set(staff.auth).send({ accept: true }).expect(403);
    const on = await t.http().put('/api/assistant/consent').set(admin.auth).send({ accept: true }).expect(200);
    expect(on.body.givenAt).toBeTruthy();
    const off = await t.http().put('/api/assistant/consent').set(admin.auth).send({ accept: false }).expect(200);
    expect(off.body.givenAt).toBeNull();
  });
});
