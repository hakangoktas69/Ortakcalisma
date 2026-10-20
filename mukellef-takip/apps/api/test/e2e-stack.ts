import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { loadConfig } from '../src/platform/config/config.js';
import { configureApp } from '../src/platform/http/configure-app.js';
import { VaultService, localKeyRing } from '../src/platform/crypto/vault.service.js';
import { PersonalDataService } from '../src/platform/crypto/personal-data.js';
import { hashPassword } from '../src/modules/identity/infrastructure/password-hasher.js';
import { makeTckn } from '../src/shared-kernel/testing/test-tckn.js';

/**
 * Uçtan uca test ortamı: geçici veritabanı + migration'lar + uygulama rolü + iki büro + gerçek Nest uygulaması.
 * - E2E_ADMIN_DATABASE_URL ve E2E_REDIS_URL verilmişse onları kullanır (CI servis container'ları).
 * - Verilmemişse Testcontainers ile PostgreSQL 17 ve Redis 7 açar (Docker gerekir).
 * Uygulama, RLS'e tabi rol (app_user üyesi) ile bağlanır: izolasyon testleri gerçek politikaları sınar.
 */
export interface Stack {
  app: NestExpressApplication;
  admin: PrismaClient;
  appRoleUrl: string;
  tenants: { A: TenantFixture; B: TenantFixture };
  close: () => Promise<void>;
}

export interface TenantFixture {
  id: string;
  email: string;
  password: string;
  companyId: string;
  reportId: string;
}

const KEY = randomBytes(32).toString('base64');

export async function startStack(): Promise<Stack> {
  const stops: (() => Promise<unknown>)[] = [];
  let adminBase = process.env.E2E_ADMIN_DATABASE_URL;
  let redisUrl = process.env.E2E_REDIS_URL;
  if (!adminBase) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const c = await new PostgreSqlContainer('postgres:17-alpine').start();
    stops.push(() => c.stop());
    adminBase = c.getConnectionUri();
  }
  if (!redisUrl) {
    const { GenericContainer } = await import('testcontainers');
    const r = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    stops.push(() => r.stop());
    redisUrl = `redis://${r.getHost()}:${r.getMappedPort(6379)}`;
  }

  // Her koşu kendi veritabanında
  const dbName = `e2e_${randomBytes(4).toString('hex')}`;
  const adminPg = new pg.Client({ connectionString: adminBase });
  await adminPg.connect();
  await adminPg.query(`CREATE DATABASE ${dbName}`);
  const adminUrl = withDb(adminBase, dbName);
  execSync('npx prisma migrate deploy', { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, DATABASE_URL: adminUrl }, stdio: 'pipe' });

  // Uygulama rolü: migration'ın oluşturduğu app_user'a üye, şifreyle giriş yapabilen rol
  const appPassword = randomBytes(12).toString('hex');
  await adminPg.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e2e_app') THEN CREATE ROLE e2e_app LOGIN IN ROLE app_user; END IF; END $$`);
  await adminPg.query(`ALTER ROLE e2e_app PASSWORD '${appPassword}'`);
  await adminPg.end();
  const appRoleUrl = withDb(withUser(adminBase, 'e2e_app', appPassword), dbName);

  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: adminUrl }) });
  const personal = new PersonalDataService(new VaultService(localKeyRing(KEY)));
  const A = await seedTenant(admin, personal, 'A', '1000000001');
  const B = await seedTenant(admin, personal, 'B', '1000000002');

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: appRoleUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: randomBytes(32).toString('hex'),
    VAULT_KEY: KEY,
    SGK_MODE: 'mock',
    GIB_MODE: 'mock',
    WHATSAPP_MODE: 'off',
    ASSISTANT_MODE: 'off',
    LOG_LEVEL: 'warn',
  });
  const config = loadConfig(process.env, () => {});
  const { AppModule } = await import('../src/app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  configureApp(app, config);
  await app.init();

  return {
    app,
    admin,
    appRoleUrl,
    tenants: { A, B },
    close: async () => {
      await app.close();
      await admin.$disconnect();
      for (const stop of stops.reverse()) await stop();
    },
  };
}

async function seedTenant(db: PrismaClient, personal: PersonalDataService, tag: string, taxNumber: string): Promise<TenantFixture> {
  const password = `E2e-Sifre-${tag}-2026`;
  const tenant = await db.tenant.create({ data: { name: `${tag} Bürosu` } });
  await db.subscription.create({ data: { tenantId: tenant.id, expiresAt: new Date(Date.now() + 365 * 86_400_000) } });
  const email = `yonetici-${tag.toLowerCase()}@e2e.test`;
  await db.user.create({ data: { tenantId: tenant.id, email, passwordHash: await hashPassword(password), fullName: `${tag} Yönetici`, role: 'ADMIN' } });
  const company = await db.company.create({ data: { tenantId: tenant.id, title: `${tag} Firması`, taxNumber, type: 'SIRKET' } });
  const wp = await db.sgkWorkplace.create({ data: { companyId: company.id, registryNo: `2${taxNumber}0000000001` } });
  const report = await db.sgkReport.create({
    data: { workplaceId: wp.id, medulaRaporId: `R-${tag}`, vaka: 3, ...personal.seal({ tckn: makeTckn(`10000000${tag === 'A' ? 1 : 2}`), fullName: `${tag} Çalışan` }) },
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
