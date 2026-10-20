import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Session, type TestApp, bootApp, stack } from './support/app.js';

// iyzico Ödeme Formu regresyonu (sahte iyzico sunucusuyla): imzalı istek, ödeme sayfası, geri dönüşte
// tarayıcıya güvenmeden iyzico'ya sorma ve tutar / dolandırıcılık / sepet doğrulamaları.

type Scenario = 'ok' | 'review' | 'wrong-amount' | 'other-basket';
const scenarios = new Map<string, Scenario>();
let lastInit: Record<string, unknown> | null = null;
let authHeaders: string[] = [];
let server: Server;
let t: TestApp;
let admin: Session;
const tenantId = () => stack().B.id;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      authHeaders.push(String(req.headers.authorization ?? ''));
      const body = JSON.parse(raw || '{}');
      res.setHeader('Content-Type', 'application/json');
      if (req.url?.includes('initialize')) {
        lastInit = body;
        const token = `tok-${body.conversationId}`;
        res.end(JSON.stringify({ status: 'success', token, paymentPageUrl: `https://sandbox.iyzico.test/pay/${token}` }));
        return;
      }
      if (req.url?.includes('detail')) {
        const paymentId = String(body.token).replace(/^tok-/, '');
        const s = scenarios.get(body.token) ?? 'ok';
        const price = lastInit?.price;
        res.end(
          JSON.stringify({
            status: 'success',
            paymentStatus: 'SUCCESS',
            fraudStatus: s === 'review' ? 0 : 1,
            paidPrice: s === 'wrong-amount' ? '1.00' : price,
            price,
            currency: 'TRY',
            basketId: s === 'other-basket' ? 'baska' : paymentId,
            conversationId: paymentId,
            paymentId: `iyz-${paymentId}`,
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  t = await bootApp({ BILLING_PROVIDER: 'iyzico', IYZICO_API_KEY: 'sandbox-key', IYZICO_SECRET_KEY: 'sandbox-secret', IYZICO_BASE_URL: `http://127.0.0.1:${port}` });
  admin = await t.login(stack().B.email, stack().B.password);
  await t.http().put('/api/billing/profile').set(admin.auth).send({
    billingName: 'B Müşavirlik',
    billingContactName: 'Bora Yönetici',
    billingTaxNumber: '1111111111',
    billingAddress: 'Atatürk Cad. No:5 Çankaya',
    billingCity: 'Ankara',
    billingEmail: 'odeme@b-buro.test',
    billingPhone: '+905551112233',
  }).expect(200);
}, 120_000);

afterAll(async () => {
  await t?.close();
  await new Promise((r) => server?.close(r));
});

async function checkout(scenario: Scenario) {
  const co = await t.http().post('/api/billing/checkout').set(admin.auth).send({ plan: 'baslangic', months: 12 }).expect(201);
  expect(co.body.redirectUrl).toMatch(/^https:\/\/sandbox\.iyzico\.test\/pay\//);
  scenarios.set(`tok-${co.body.id}`, scenario);
  return co.body as { id: string; amount: number };
}

const callback = (token: string) => t.http().post('/api/billing/iyzico/callback').type('form').send({ token });

describe('iyzico', () => {
  it('ödeme sayfası isteği imzalı, tutar sunucuda hesaplanmış, taksit kapalı', async () => {
    authHeaders = [];
    const co = await checkout('ok');
    expect(authHeaders[0]).toMatch(/^IYZWSv2 /);
    expect(lastInit).toMatchObject({ conversationId: co.id, basketId: co.id, enabledInstallments: [1], currency: 'TRY' });
    expect(Number(lastInit!.price)).toBe(co.amount);
  });

  it('başarılı ödeme: geri dönüş iyzico\'ya sorar, lisansı uzatır', async () => {
    const before = await t.db.subscription.findUniqueOrThrow({ where: { tenantId: tenantId() } });
    const co = await checkout('ok');
    const res = await callback(`tok-${co.id}`).expect(303);
    expect(res.headers.location).toMatch(/odeme=basarili/);
    const p = await t.db.payment.findUniqueOrThrow({ where: { id: co.id } });
    expect(p).toMatchObject({ status: 'PAID', providerRef: `iyz-${co.id}`, fraudStatus: 1 });
    const after = await t.db.subscription.findUniqueOrThrow({ where: { tenantId: tenantId() } });
    expect(after.expiresAt.getTime()).toBeGreaterThan(before.expiresAt.getTime());
    // Aynı geri dönüş tekrar gelirse lisans ikinci kez uzamaz
    await callback(`tok-${co.id}`).expect(303);
    expect((await t.db.subscription.findUniqueOrThrow({ where: { tenantId: tenantId() } })).expiresAt.getTime()).toBe(after.expiresAt.getTime());
  });

  it('dolandırıcılık incelemesi beklemede kalır; durumu yenile yeniden sorar', async () => {
    const co = await checkout('review');
    const res = await callback(`tok-${co.id}`).expect(303);
    expect(res.headers.location).toMatch(/odeme=inceleniyor/);
    expect((await t.db.payment.findUniqueOrThrow({ where: { id: co.id } })).status).toBe('PENDING');
    scenarios.set(`tok-${co.id}`, 'ok');
    const r = await t.http().post(`/api/billing/payments/${co.id}/refresh`).set(admin.auth).expect(201);
    expect(r.body.outcome).toBe('PAID');
  });

  it('tahsil edilen tutar farklıysa ya da sepet başka ödemeye aitse onaylanmaz', async () => {
    for (const s of ['wrong-amount', 'other-basket'] as const) {
      const before = await t.db.subscription.findUniqueOrThrow({ where: { tenantId: tenantId() } });
      const co = await checkout(s);
      const res = await callback(`tok-${co.id}`).expect(303);
      expect(res.headers.location).toMatch(/odeme=basarisiz/);
      expect((await t.db.payment.findUniqueOrThrow({ where: { id: co.id } })).status).toBe('FAILED');
      expect((await t.db.subscription.findUniqueOrThrow({ where: { tenantId: tenantId() } })).expiresAt.getTime()).toBe(before.expiresAt.getTime());
    }
  });

  it('fatura bilgisi eksikse ödeme başlatılmaz', async () => {
    await t.db.tenant.update({ where: { id: tenantId() }, data: { billingCity: null } });
    await t.http().post('/api/billing/checkout').set(admin.auth).send({ plan: 'baslangic', months: 12 }).expect(400);
    await t.db.tenant.update({ where: { id: tenantId() }, data: { billingCity: 'Ankara' } });
  });
});
