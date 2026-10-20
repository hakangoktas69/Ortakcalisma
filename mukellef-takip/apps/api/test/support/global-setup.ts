import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { VaultService, localKeyRing } from '../../src/platform/crypto/vault.service.js';
import { PersonalDataService } from '../../src/platform/crypto/personal-data.js';
import { hashPassword } from '../../src/modules/identity/infrastructure/password-hasher.js';
import { makeTckn } from '../../src/shared-kernel/testing/test-tckn.js';
import type { StackInfo, TenantFixture } from './stack-info.js';

/**
 * E2E koşusu başına bir kez: geçici veritabanı, migration'lar, uygulama rolü, demo verisi (prisma/seed.ts)
 * ve izolasyon testleri için ikinci büro (B). Bilgiler test dosyalarına `inject('stack')` ile verilir.
 * - E2E_ADMIN_DATABASE_URL / E2E_REDIS_URL verilmişse onları kullanır (CI, `npm run verify`).
 * - Verilmemişse Testcontainers ile PostgreSQL 17 + Redis 7 açar.
 */
export default async function setup(project: TestProject) {
  const stops: (() => Promise<unknown>)[] = [];
  let adminBase = process.env.E2E_ADMIN_DATABASE_URL;
  let redisUrl = process.env.E2E_REDIS_URL;
  if (!adminBase) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const c = await new PostgreSqlContainer('postgres:17.11-alpine').start();
    stops.push(() => c.stop());
    adminBase = c.getConnectionUri();
  }
  if (!redisUrl) {
    const { GenericContainer } = await import('testcontainers');
    const r = await new GenericContainer('redis:7.4.11-alpine').withExposedPorts(6379).start();
    stops.push(() => r.stop());
    redisUrl = `redis://${r.getHost()}:${r.getMappedPort(6379)}`;
  }

  const dbName = `e2e_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminBase });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  const adminUrl = withDb(adminBase, dbName);
  const apiDir = fileURLToPath(new URL('../..', import.meta.url));
  const vaultKey = randomBytes(32).toString('base64');
  const run = (cmd: string) => execSync(cmd, { cwd: apiDir, env: { ...process.env, DATABASE_URL: adminUrl, VAULT_KEY: vaultKey }, stdio: 'pipe' });
  run('npx prisma migrate deploy');
  run('npx tsx prisma/seed.ts');

  const appPassword = randomBytes(12).toString('hex');
  await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e2e_app') THEN CREATE ROLE e2e_app LOGIN IN ROLE app_user; END IF; END $$`);
  await admin.query(`ALTER ROLE e2e_app PASSWORD '${appPassword}'`);
  await admin.end();

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) });
  const personal = new PersonalDataService(new VaultService(localKeyRing(vaultKey)));
  const demoTenant = await db.user.findUniqueOrThrow({ where: { email: 'demo@mukellef.test' }, select: { tenantId: true } });
  const demoCompany = await db.company.findFirstOrThrow({ where: { tenantId: demoTenant.tenantId, isActive: true }, orderBy: { title: 'asc' } });
  const demoReport = await db.sgkReport.findFirst({ where: { workplace: { company: { tenantId: demoTenant.tenantId } } } });
  const B = await seedTenantB(db, personal);
  await db.$disconnect();

  const info: StackInfo = {
    adminUrl,
    appRoleUrl: withDb(withUser(adminBase, 'e2e_app', appPassword), dbName),
    redisUrl,
    vaultKey,
    jwtSecret: randomBytes(32).toString('hex'),
    demo: {
      id: demoTenant.tenantId,
      email: 'demo@mukellef.test',
      password: 'Demo1234!',
      staffEmail: 'personel@mukellef.test',
      staffPassword: 'Personel2026',
      companyId: demoCompany.id,
      reportId: demoReport?.id ?? null,
    },
    B,
  };
  project.provide('stack', info);

  return async () => {
    const c = new pg.Client({ connectionString: adminBase });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
    await c.end();
    for (const stop of stops.reverse()) await stop();
  };
}

async function seedTenantB(db: PrismaClient, personal: PersonalDataService): Promise<TenantFixture> {
  const password = 'E2e-Buro-B-2026';
  const tenant = await db.tenant.create({ data: { name: 'B Bürosu' } });
  await db.subscription.create({ data: { tenantId: tenant.id, expiresAt: new Date(Date.now() + 365 * 86_400_000) } });
  const email = 'yonetici@b-buro.test';
  await db.user.create({ data: { tenantId: tenant.id, email, passwordHash: await hashPassword(password), fullName: 'B Yönetici', role: 'ADMIN' } });
  const company = await db.company.create({ data: { tenantId: tenant.id, title: 'B Firması', taxNumber: '1000000002', type: 'SIRKET' } });
  const wp = await db.sgkWorkplace.create({ data: { companyId: company.id, registryNo: '210000000020000000001' } });
  const report = await db.sgkReport.create({
    data: { workplaceId: wp.id, medulaRaporId: 'R-B', vaka: 3, ...personal.seal({ tckn: makeTckn('100000002'), fullName: 'B Çalışan' }) },
  });
  return { id: tenant.id, email, password, companyId: company.id, reportId: report.id };
}

function withDb(url: string, db: string) {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

function withUser(url: string, user: string, password: string) {
  const u = new URL(url);
  u.username = user;
  u.password = password;
  return u.toString();
}
