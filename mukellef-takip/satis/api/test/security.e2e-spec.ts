import pg from 'pg';
import { stack } from './support/app.js';

// Veritabanı düzeyinde ayrım (migration satis_modulu): uygulama kodunda bir hata olsa bile
// satış rolü mükellef verisini, müşavir rolü satış tablolarını okuyamaz.

async function asRole(url: string, sql: string) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await c.query(sql);
  } finally {
    await c.end();
  }
}

describe('satış rolü (sales_user)', () => {
  const satis = (sql: string) => asRole(stack().satisRoleUrl, sql);

  it.each([
    'SELECT * FROM "Company"',
    'SELECT "title" FROM "Company"',
    'SELECT "taxNumber" FROM "Company"',
    'SELECT * FROM "Declaration"',
    'SELECT * FROM "SgkReport"',
    'SELECT * FROM "Invoice"',
    'SELECT * FROM "SgkWorkplace"',
    'SELECT * FROM "Payment"',
    'SELECT * FROM "Session"',
    'SELECT * FROM "ApiToken"',
    'SELECT * FROM "_prisma_migrations"',
  ])('mükellef ve iş verisine erişemez: %s', async (sql) => {
    await expect(satis(sql)).rejects.toThrow(/permission denied/);
  });

  it('mükellef sayısını büro bağlamı kurmadan tüm bürolar için okuyabilir', async () => {
    const r = await satis('SELECT count(*)::int AS n FROM "Company" WHERE "isActive"');
    expect(r.rows[0].n).toBeGreaterThan(0);
    const t = await satis('SELECT count(*)::int AS n FROM "Tenant"');
    expect(t.rows[0].n).toBeGreaterThan(0);
  });

  it('denetim kaydını değiştiremez ve silemez; mükellef ekleyemez', async () => {
    await expect(satis('UPDATE "AuditLog" SET action = \'x\'')).rejects.toThrow(/permission denied/);
    await expect(satis('DELETE FROM "AuditLog"')).rejects.toThrow(/permission denied/);
    await expect(satis('DELETE FROM "SalesAuditLog"')).rejects.toThrow(/permission denied/);
    await expect(satis('UPDATE "SalesAuditLog" SET action = \'x\'')).rejects.toThrow(/permission denied/);
    await expect(satis('DELETE FROM "Tenant"')).rejects.toThrow(/permission denied/);
    await expect(satis('INSERT INTO "Company" (id) VALUES (\'x\')')).rejects.toThrow(/permission denied/);
  });
});

describe('müşavir rolü (app_user)', () => {
  const app = (sql: string) => asRole(stack().appRoleUrl, sql);

  it.each(['SELECT * FROM "SalesUser"', 'SELECT * FROM "SalesAccount"', 'SELECT * FROM "SalesAuditLog"'])(
    'satış tablolarına erişemez: %s',
    async (sql) => {
      await expect(app(sql)).rejects.toThrow(/permission denied/);
    },
  );
});
