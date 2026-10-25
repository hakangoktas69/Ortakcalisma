import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from './db.ts';

// Migration çalıştırıcı: supabase/migrations/{control,tenant}/*.sql ada göre sırayla, her biri kendi işleminde.
// Uygulanmış dosya değiştirilemez (özet karşılaştırılır); düzeltme yeni migration'dır.

export type MigrationFile = { readonly name: string; readonly sql: string; readonly checksum: string };
export type Applied = { readonly name: string; readonly checksum: string };

export const checksum = (sql: string) => createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

export function readMigrations(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name), 'utf8');
      return { name, sql, checksum: checksum(sql) };
    });
}

/** Uygulanacakları seçer; uygulanmış bir dosya değişmiş ya da silinmişse hata verir. */
export function plan(files: readonly MigrationFile[], applied: readonly Applied[]): MigrationFile[] {
  const byName = new Map(files.map((f) => [f.name, f]));
  for (const a of applied) {
    const f = byName.get(a.name);
    if (!f) throw new Error(`Uygulanmış migration depoda yok: ${a.name}`);
    if (f.checksum !== a.checksum) throw new Error(`Uygulanmış migration değiştirilmiş: ${a.name} (yeni bir migration yazın)`);
  }
  const done = new Set(applied.map((a) => a.name));
  return files.filter((f) => !done.has(f.name));
}

export async function migrate(pool: Pool, files: readonly MigrationFile[]): Promise<string[]> {
  const c = await pool.connect();
  try {
    await c.query('select pg_advisory_lock(hashtext($1))', ['eworks-migrate']);
    await c.query(`create schema if not exists migrations;
      create table if not exists migrations.applied (name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    const applied = (await c.query<Applied>('select name, checksum from migrations.applied order by name')).rows;
    const todo = plan(files, applied);
    for (const f of todo) {
      await c.query('begin');
      try {
        await c.query(f.sql);
        await c.query('insert into migrations.applied(name, checksum) values ($1, $2)', [f.name, f.checksum]);
        await c.query('commit');
      } catch (err) {
        await c.query('rollback');
        throw new Error(`Migration başarısız: ${f.name} — ${(err as Error).message}`);
      }
    }
    return todo.map((f) => f.name);
  } finally {
    await c.query('select pg_advisory_unlock(hashtext($1))', ['eworks-migrate']).catch(() => {});
    c.release();
  }
}

/** Uygulama giriş rollerinin parolaları SQL dosyasına yazılmaz; migration sonrası ortamdan atanır. */
export async function setRolePasswords(pool: Pool, roles: Record<string, string | undefined>) {
  for (const [role, password] of Object.entries(roles)) {
    if (!password) continue;
    const { rows } = await pool.query<{ sql: string }>(`select format('alter role %I password %L', $1::text, $2::text) as sql`, [role, password]);
    await pool.query(rows[0]!.sql);
  }
}
