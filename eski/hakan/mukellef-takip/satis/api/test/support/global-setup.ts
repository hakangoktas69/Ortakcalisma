import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

export interface SatisStack {
  /** Tablo sahibi (yönetici) bağlantısı: test verisi hazırlama ve sonuç kontrolü (RLS dışı) */
  adminUrl: string;
  /** Satış API'sinin bağlandığı rol (sales_user üyesi) */
  satisRoleUrl: string;
  /** Müşavir API'sinin rolü (app_user üyesi): satış tablolarını göremediğini sınamak için */
  appRoleUrl: string;
  vaultKey: string;
  jwtSecret: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    satis: SatisStack;
  }
}

/**
 * Koşu başına bir kez: geçici veritabanı, müşavir API'sinin migration'ları (satis_modulu dahil) ve demo verisi,
 * test giriş rolleri. E2E_ADMIN_DATABASE_URL verilmemişse Testcontainers ile PostgreSQL 17 açar.
 */
export default async function setup(project: TestProject) {
  const stops: (() => Promise<unknown>)[] = [];
  let adminBase = process.env.E2E_ADMIN_DATABASE_URL;
  if (!adminBase) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const c = await new PostgreSqlContainer('postgres:17.11-alpine').start();
    stops.push(() => c.stop());
    adminBase = c.getConnectionUri();
  }

  const dbName = `satis_e2e_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminBase });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  const adminUrl = withDb(adminBase, dbName);
  const apiDir = fileURLToPath(new URL('../../../../apps/api', import.meta.url));
  const vaultKey = randomBytes(32).toString('base64');
  const run = (cmd: string) => execSync(cmd, { cwd: apiDir, env: { ...process.env, DATABASE_URL: adminUrl, VAULT_KEY: vaultKey }, stdio: 'pipe' });
  run('npx prisma migrate deploy');
  run('npx tsx prisma/seed.ts');

  // Roller küme genelindedir: aynı sunucuda tekrar koşulursa parola yenilenir
  const satisPw = randomBytes(12).toString('hex');
  const appPw = randomBytes(12).toString('hex');
  await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e2e_satis') THEN CREATE ROLE e2e_satis LOGIN IN ROLE sales_user; END IF; END $$`);
  await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e2e_app') THEN CREATE ROLE e2e_app LOGIN IN ROLE app_user; END IF; END $$`);
  await admin.query(`ALTER ROLE e2e_satis PASSWORD '${satisPw}'`);
  await admin.query(`ALTER ROLE e2e_app PASSWORD '${appPw}'`);
  await admin.end();

  project.provide('satis', {
    adminUrl,
    satisRoleUrl: withDb(withUser(adminBase, 'e2e_satis', satisPw), dbName),
    appRoleUrl: withDb(withUser(adminBase, 'e2e_app', appPw), dbName),
    vaultKey: randomBytes(32).toString('base64'),
    jwtSecret: randomBytes(32).toString('hex'),
  });

  return async () => {
    const c = new pg.Client({ connectionString: adminBase });
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
    await c.end();
    for (const stop of stops.reverse()) await stop();
  };
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
