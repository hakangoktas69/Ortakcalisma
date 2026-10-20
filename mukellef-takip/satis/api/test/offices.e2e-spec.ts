import type supertest from 'supertest';
import { verifyPassword } from '../src/core.js';
import { verifyAuditChain } from '../../../apps/api/src/platform/audit/audit-chain.js';
import { bootApp, createMember, CSRF, signIn, type Member, type TestApp } from './support/app.js';

let t: TestApp;
let me: Member;
let agent: supertest.Agent;
let demoId: string;

beforeAll(async () => {
  t = await bootApp();
  me = await createMember(t, 'satisci@satis.test');
  agent = await signIn(t, me);
  demoId = (await t.db.user.findUniqueOrThrow({ where: { email: 'demo@mukellef.test' } })).tenantId;
});
afterAll(() => t.close());

const newOffice = (over: Record<string, unknown> = {}) => ({
  officeName: 'Yılmaz Mali Müşavirlik',
  contactName: 'Ayşe Yılmaz',
  email: 'ayse@yilmaz-mm.test',
  phone: '0532 123 45 67',
  ...over,
});

describe('yeni müşavir (büro) kaydı', () => {
  let officeId: string;
  let tempPassword: string;

  it('büro, yönetici kullanıcı, deneme lisansı ve satış kaydı birlikte açılır', async () => {
    const r = await agent.post('/api/satis/offices').set(CSRF).send(newOffice({ trialDays: 14 })).expect(201);
    ({ id: officeId, tempPassword } = r.body);
    expect(r.body.loginEmail).toBe('ayse@yilmaz-mm.test');

    const tenant = await t.db.tenant.findUniqueOrThrow({ where: { id: officeId }, include: { subscription: true, salesAccount: true, users: true } });
    expect(tenant.name).toBe('Yılmaz Mali Müşavirlik');
    expect(tenant.require2fa).toBe(true);
    expect(tenant.billingPhone).toBe('+905321234567');
    expect(tenant.subscription?.plan).toBe('baslangic');
    const days = (tenant.subscription!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
    expect(tenant.salesAccount?.createdById).toBe(me.id);
    expect(tenant.users).toHaveLength(1);
    const u = tenant.users[0];
    expect(u).toMatchObject({ role: 'ADMIN', mustChangePassword: true, fullName: 'Ayşe Yılmaz', phone: '905321234567' });
    // Satışın verdiği geçici şifre müşavir sitesinin şifre özetiyle doğrulanır
    expect(await verifyPassword(u.passwordHash, tempPassword)).toBe(true);
  });

  it('işlem hem satış kaydına hem büronun kendi denetim kaydına (sağlam zincirle) yazılır', async () => {
    const sales = await t.db.salesAuditLog.findFirstOrThrow({ where: { action: 'sales.office.create', target: officeId } });
    expect(sales.salesUserId).toBe(me.id);
    const rows = await t.db.auditLog.findMany({ where: { tenantId: officeId }, orderBy: { seq: 'asc' } });
    expect(rows.map((r) => r.action)).toEqual(['sales.office.create']);
    expect(rows[0].detail).toMatchObject({ salesUserId: me.id, plan: 'baslangic', trialDays: 14 });
    expect(verifyAuditChain(rows).ok).toBe(true);
  });

  it('aynı e-posta ikinci kez kullanılamaz; geçersiz telefon ve paket reddedilir', async () => {
    await agent.post('/api/satis/offices').set(CSRF).send(newOffice()).expect(400);
    await agent.post('/api/satis/offices').set(CSRF).send(newOffice({ email: 'demo@mukellef.test' })).expect(400);
    await agent.post('/api/satis/offices').set(CSRF).send(newOffice({ email: 'b@x.test', phone: '123' })).expect(400);
    await agent.post('/api/satis/offices').set(CSRF).send(newOffice({ email: 'c@x.test', plan: 'yok' })).expect(400);
    await agent.post('/api/satis/offices').set(CSRF).send(newOffice({ email: 'd@x.test', trialDays: 365 })).expect(400);
    await agent.post('/api/satis/offices').set(CSRF).send({ ...newOffice({ email: 'e@x.test' }), extra: 1 }).expect(400);
  });

  it('listede durum, paket ve mükellef SAYISI görünür; arama ve durum süzgeci çalışır', async () => {
    const all = await agent.get('/api/satis/offices').expect(200);
    const mine = all.body.find((o: { id: string }) => o.id === officeId);
    expect(mine).toMatchObject({ status: 'deneme', companyCount: 0, contactPhone: '905321234567', plan: 'baslangic' });
    const demo = all.body.find((o: { id: string }) => o.id === demoId);
    expect(demo.companyCount).toBeGreaterThan(0);
    expect(demo.contactEmail).toBe('demo@mukellef.test');

    const found = await agent.get('/api/satis/offices').query({ q: 'yılmaz' }).expect(200);
    expect(found.body.map((o: { id: string }) => o.id)).toEqual([officeId]);
    const byPhone = await agent.get('/api/satis/offices').query({ q: '0532 123' }).expect(200);
    expect(byPhone.body.map((o: { id: string }) => o.id)).toContain(officeId);
    const trials = await agent.get('/api/satis/offices').query({ status: 'deneme' }).expect(200);
    expect(trials.body.every((o: { status: string }) => o.status === 'deneme')).toBe(true);
    await agent.get('/api/satis/offices').query({ status: 'gecersiz' }).expect(400);
  });

  it('ayrıntıda mükellef verisi yok; kullanıcılar gizli alan içermez', async () => {
    const r = await agent.get(`/api/satis/offices/${demoId}`).expect(200);
    const body = JSON.stringify(r.body);
    expect(body).not.toMatch(/passwordHash|totpSecret|recoveryCode|taxNumber|title/);
    expect(r.body.users.length).toBeGreaterThanOrEqual(2);
    expect(r.body.users[0]).toHaveProperty('twoFactorEnabled');
    await agent.get('/api/satis/offices/olmayan').expect(404);
  });

  it('bilgi güncelleme, lisans uzatma (deneme → aktif) ve paket değişikliği', async () => {
    await agent.patch(`/api/satis/offices/${officeId}`).set(CSRF).send({ contactPhone: 'abc' }).expect(400);
    const up = await agent.patch(`/api/satis/offices/${officeId}`).set(CSRF).send({ officeName: 'Yılmaz SMMM', contactPhone: '05551112233' }).expect(200);
    expect(up.body).toMatchObject({ name: 'Yılmaz SMMM', contactPhone: '905551112233' });

    await agent.post(`/api/satis/offices/${officeId}/extend`).set(CSRF).send({}).expect(400);
    await agent.post(`/api/satis/offices/${officeId}/extend`).set(CSRF).send({ months: 3 }).expect(400);
    const ext = await agent.post(`/api/satis/offices/${officeId}/extend`).set(CSRF).send({ months: 12, plan: 'pro' }).expect(200);
    expect(ext.body).toMatchObject({ status: 'aktif', plan: 'pro', companyQuota: 150 });
    expect(ext.body.history.map((h: { action: string }) => h.action).slice(0, 2)).toEqual(['sales.office.extend', 'sales.office.update']);
    expect(ext.body.history[0].by).toBe('satisci');
  });

  it('müşavirin şifresini ve iki adımlı doğrulamasını sıfırlar; başka büronun kullanıcısına dokunamaz', async () => {
    const user = await t.db.user.findFirstOrThrow({ where: { tenantId: officeId } });
    await t.db.user.update({ where: { id: user.id }, data: { mustChangePassword: false, totpEnabledAt: new Date(), totpSecretEnc: 'v1:x:y:z', lockedUntil: new Date(Date.now() + 60_000) } });
    const r = await agent.post(`/api/satis/offices/${officeId}/users/${user.id}/reset-password`).set(CSRF).expect(200);
    let after = await t.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(after.passwordHash, r.body.tempPassword)).toBe(true);
    expect(after).toMatchObject({ mustChangePassword: true, lockedUntil: null, sessionVersion: user.sessionVersion + 1 });

    await agent.post(`/api/satis/offices/${officeId}/users/${user.id}/reset-2fa`).set(CSRF).expect(200);
    after = await t.db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({ totpEnabledAt: null, totpSecretEnc: null, sessionVersion: user.sessionVersion + 2 });

    const demoUser = await t.db.user.findUniqueOrThrow({ where: { email: 'demo@mukellef.test' } });
    await agent.post(`/api/satis/offices/${officeId}/users/${demoUser.id}/reset-password`).set(CSRF).expect(404);
  });
});

describe('dondurma', () => {
  it('aktif kullanıcıları kapatır, açınca yalnız onları geri açar (önceden kapalı olan kapalı kalır)', async () => {
    const staff = await t.db.user.findUniqueOrThrow({ where: { email: 'personel@mukellef.test' } });
    await t.db.user.update({ where: { id: staff.id }, data: { isActive: false } });
    const admin = await t.db.user.findUniqueOrThrow({ where: { email: 'demo@mukellef.test' } });

    const s = await agent.post(`/api/satis/offices/${demoId}/suspend`).set(CSRF).send({ reason: 'Ödeme yok' }).expect(200);
    expect(s.body.status).toBe('donduruldu');
    expect(await t.db.user.findUniqueOrThrow({ where: { id: admin.id } })).toMatchObject({ isActive: false, sessionVersion: admin.sessionVersion + 1 });
    await agent.post(`/api/satis/offices/${demoId}/suspend`).set(CSRF).send({}).expect(400);
    // Satış dışında açılmış büroya satış kaydı yöneticiden oluşturulur
    expect((await t.db.salesAccount.findUniqueOrThrow({ where: { tenantId: demoId } })).contactEmail).toBe('demo@mukellef.test');

    const r = await agent.post(`/api/satis/offices/${demoId}/resume`).set(CSRF).expect(200);
    expect(r.body.status).not.toBe('donduruldu');
    expect((await t.db.user.findUniqueOrThrow({ where: { id: admin.id } })).isActive).toBe(true);
    expect((await t.db.user.findUniqueOrThrow({ where: { id: staff.id } })).isActive).toBe(false);
    await agent.post(`/api/satis/offices/${demoId}/resume`).set(CSRF).expect(400);
    await t.db.user.update({ where: { id: staff.id }, data: { isActive: true } });
  });
});

describe('satış ekibi', () => {
  it('ekip arkadaşı ekler (geçici şifre), kapatır; kendini kapatamaz', async () => {
    const r = await agent.post('/api/satis/team').set(CSRF).send({ email: 'Yeni@Satis.test', fullName: 'Yeni Satışçı' }).expect(201);
    expect(r.body.email).toBe('yeni@satis.test');
    const created = await t.db.salesUser.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(created).toMatchObject({ mustChangePassword: true, totpEnabledAt: null, createdById: me.id });
    expect(await verifyPassword(created.passwordHash, r.body.tempPassword)).toBe(true);
    await agent.post('/api/satis/team').set(CSRF).send({ email: 'yeni@satis.test', fullName: 'Tekrar' }).expect(400);

    const list = await agent.get('/api/satis/team').expect(200);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|totpSecret/);
    expect(list.body.find((u: { isMe: boolean }) => u.isMe).id).toBe(me.id);

    await agent.patch(`/api/satis/team/${me.id}`).set(CSRF).send({ isActive: false }).expect(400);
    await agent.patch(`/api/satis/team/${r.body.id}`).set(CSRF).send({ isActive: false }).expect(200);
    expect((await t.db.salesUser.findUniqueOrThrow({ where: { id: r.body.id } })).isActive).toBe(false);
    await agent.patch('/api/satis/team/olmayan').set(CSRF).send({ isActive: true }).expect(404);
  });

  it('ekip arkadaşının şifresini ve 2FA\'sını sıfırlar; kendisininkini bu yoldan sıfırlayamaz', async () => {
    const other = await createMember(t, 'diger@satis.test');
    const r = await agent.post(`/api/satis/team/${other.id}/reset-password`).set(CSRF).expect(200);
    expect(r.body.tempPassword).toHaveLength(12);
    await agent.post(`/api/satis/team/${other.id}/reset-2fa`).set(CSRF).expect(200);
    expect((await t.db.salesUser.findUniqueOrThrow({ where: { id: other.id } })).totpEnabledAt).toBeNull();
    await agent.post(`/api/satis/team/${me.id}/reset-password`).set(CSRF).expect(400);
    await agent.post(`/api/satis/team/${me.id}/reset-2fa`).set(CSRF).expect(400);
  });

  it('paket listesi', async () => {
    const r = await agent.get('/api/satis/offices/plans').expect(200);
    expect(r.body.map((p: { key: string }) => p.key)).toEqual(['baslangic', 'pro', 'kurumsal']);
  });
});
