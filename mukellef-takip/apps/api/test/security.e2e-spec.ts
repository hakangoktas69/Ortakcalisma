import request from 'supertest';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Stack, startStack } from './e2e-stack.js';

// Büro izolasyonu (uygulama + PostgreSQL RLS), oturum yenileme ve denetim kaydı için uçtan uca testler.
// Yeni tenant'lı tablo / uç eklendiğinde buraya çapraz erişim testi eklenir (docs/ai/conventions.md).

let s: Stack;
const tokens: Record<'A' | 'B', { access: string; refresh: string }> = {} as never;
const http = () => request(s.app.getHttpServer());
const auth = (t: 'A' | 'B') => ({ Authorization: `Bearer ${tokens[t].access}` });

async function login(t: 'A' | 'B') {
  const { email, password } = s.tenants[t];
  const res = await http().post('/api/auth/login').send({ email, password }).expect(201);
  tokens[t] = { access: res.body.accessToken, refresh: res.body.refreshToken };
}

beforeAll(async () => {
  s = await startStack();
  await login('A');
  await login('B');
}, 240_000);

afterAll(async () => {
  await s?.close();
});

describe('büro izolasyonu (HTTP)', () => {
  it('her büro yalnız kendi firmalarını görür', async () => {
    const a = await http().get('/api/companies').set(auth('A')).expect(200);
    const b = await http().get('/api/companies').set(auth('B')).expect(200);
    expect(a.body.map((c: { id: string }) => c.id)).toEqual([s.tenants.A.companyId]);
    expect(b.body.map((c: { id: string }) => c.id)).toEqual([s.tenants.B.companyId]);
  });

  it('başka büronun firmasına doğrudan kimlikle erişilemez', async () => {
    await http().get(`/api/companies/${s.tenants.A.companyId}/obligations`).set(auth('B')).expect(404);
    await http().patch(`/api/companies/${s.tenants.A.companyId}`).set(auth('B')).send({ isActive: false }).expect(404);
    const still = await s.admin.company.findUniqueOrThrow({ where: { id: s.tenants.A.companyId } });
    expect(still.isActive).toBe(true);
  });

  it('SGK e-raporları büroya göre ayrılır; kişi alanları çözülmüş ve T.C. no maskeli döner', async () => {
    const res = await http().get('/api/sgk/reports').set(auth('B')).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: s.tenants.B.reportId, fullName: 'B Çalışan' });
    expect(res.body[0].tckn).toMatch(/^\d{3}\*{5}\d{3}$/);
    expect(res.body[0]).not.toHaveProperty('tcknEnc');
  });

  it('başka büronun raporu onaylanamaz', async () => {
    await http().post(`/api/sgk/reports/${s.tenants.A.reportId}/approve`).set(auth('B')).send({ nitelikDurumu: '1', tarih: '20.10.2026' }).expect(404);
  });
});

describe('veritabanı politikaları (uygulama rolüyle doğrudan SQL)', () => {
  const withClient = async <T>(fn: (c: pg.Client) => Promise<T>) => {
    const c = new pg.Client({ connectionString: s.appRoleUrl });
    await c.connect();
    try {
      return await fn(c);
    } finally {
      await c.end();
    }
  };

  it('bağlam yokken hiçbir büronun satırı görünmez (fail-closed)', async () => {
    const n = await withClient(async (c) => (await c.query('SELECT count(*)::int AS n FROM "Company"')).rows[0].n);
    expect(n).toBe(0);
  });

  it('büro bağlamında yalnız o büro görünür; başka büro adına kayıt eklenemez', async () => {
    await withClient(async (c) => {
      await c.query("SELECT set_config('app.tenant_id', $1, false)", [s.tenants.A.id]);
      expect((await c.query('SELECT count(*)::int AS n FROM "SgkReport"')).rows[0].n).toBe(1);
      await expect(
        c.query(`INSERT INTO "Company"(id, "tenantId", title, "taxNumber", type, "updatedAt") VALUES ('x', $1, 'x', '1', 'SIRKET', now())`, [s.tenants.B.id]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('denetim kaydı değiştirilemez ve silinemez', async () => {
    await withClient(async (c) => {
      await c.query("SELECT set_config('app.tenant_id', $1, false)", [s.tenants.A.id]);
      await expect(c.query(`UPDATE "AuditLog" SET action = 'x'`)).rejects.toThrow(/permission denied/);
      await expect(c.query(`DELETE FROM "AuditLog"`)).rejects.toThrow(/permission denied/);
    });
  });
});

describe('oturum', () => {
  it('yenileme anahtarı döner; eski anahtar tekrar kullanılırsa bütün oturum ailesi kapanır', async () => {
    const first = await http().post('/api/auth/refresh').send({ refreshToken: tokens.A.refresh }).expect(200);
    expect(first.body.refreshToken).not.toBe(tokens.A.refresh);
    await http().get('/api/auth/me').set({ Authorization: `Bearer ${first.body.accessToken}` }).expect(200);

    await http().post('/api/auth/refresh').send({ refreshToken: tokens.A.refresh }).expect(401);
    // Aile iptal edildi: yeni anahtar da geçersiz
    await http().get('/api/auth/me').set({ Authorization: `Bearer ${first.body.accessToken}` }).expect(401);
    await http().post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken }).expect(401);
    await login('A');
  });

  it('çıkış oturumu kapatır', async () => {
    await http().post('/api/auth/logout').set(auth('B')).expect(204);
    await http().get('/api/auth/me').set(auth('B')).expect(401);
    await login('B');
  });
});

describe('denetim kaydı zinciri', () => {
  it('girişler zincire yazılır ve zincir doğrulanır', async () => {
    const { AuditService } = await import('../src/platform/audit/audit.service.js');
    const { runAsSystem } = await import('../src/platform/database/tenant-context.js');
    const result = await runAsSystem(() => s.app.get(AuditService).verify(s.tenants.A.id));
    expect(result.ok).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });
});
