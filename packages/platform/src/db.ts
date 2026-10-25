import pg from 'pg';

// Shard erişimi (D34): uygulama shard'a doğrudan bağlanır, RLS her işlemde kullanıcının doğrulanmış
// JWT claim'leriyle uygulanır (`set local role authenticated` + `request.jwt.claims`). Giriş rolleri NOINHERIT'tir:
// rol değiştirmeden hiçbir tabloya erişemezler.

export type Pool = pg.Pool;
export type Client = pg.PoolClient;

/** Kullanıcı bağlamı: GoTrue JWT'sinden doğrulanmış kimlik ve etkin ofis. */
export type UserClaims = { readonly sub: string; readonly org?: string; readonly email?: string };

export const createPool = (url: string, max = 10): Pool => new pg.Pool({ connectionString: url, max, idleTimeoutMillis: 30_000 });

async function tx<T>(pool: Pool, prepare: (c: Client) => Promise<void>, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await prepare(c);
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (err) {
    await c.query('rollback').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

/** Kullanıcı adına işlem: RLS kullanıcının üyelik ve kapsamına göre süzer. */
export const withUser = <T>(pool: Pool, claims: UserClaims, fn: (c: Client) => Promise<T>) =>
  tx(pool, async (c) => {
    await c.query('set local role authenticated');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ ...claims, role: 'authenticated' })]);
  }, fn);

/** Sistem adına, tek bir ofisle sınırlı işlem (işçi). Politikalar yalnız eworks_worker oturumunda kabul eder. */
export const withSystem = <T>(pool: Pool, orgId: string, fn: (c: Client) => Promise<T>) =>
  tx(pool, async (c) => {
    await c.query('set local role authenticated');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'system', org: orgId })]);
  }, fn);

/** Rol değiştirmeyen işlem (kontrol düzlemi, migration). */
export const withTx = <T>(pool: Pool, fn: (c: Client) => Promise<T>) => tx(pool, async () => {}, fn);
