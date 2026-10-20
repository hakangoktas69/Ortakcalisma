import pg from 'pg';
import { currentDbContext } from './tenant-context.js';

type ConnectCallback = (err: Error | undefined, client?: pg.PoolClient, release?: (err?: Error) => void) => void;

/**
 * Prisma'nın kullandığı bağlantı havuzu. Havuzdan her bağlantı alınışında, çağıranın bağlamındaki
 * büro (app.tenant_id) ve sistem bayrağı (app.bypass_rls) oturuma yazılır; her alışta ikisi de yeniden
 * yazıldığından önceki isteğin değeri bağlantıda kalmaz.
 *
 * Bağlam, bağlantıyı İSTEYEN kodun async bağlamından alınır (AsyncLocalStorage); havuz doluyken
 * bağlantı başka bir isteğin bırakmasıyla gelse bile değer doğru isteğe aittir.
 *
 * Tehdit modeli: RLS uygulama hatalarına (unutulmuş tenantId filtresi) karşı ikinci savunma hattıdır.
 * SQL enjeksiyonuna karşı koruma Prisma'nın parametreli sorgularıdır; enjekte edilmiş SQL GUC'u değiştirebilir.
 */
export function createRlsPool(config: pg.PoolConfig): pg.Pool {
  const pool = new pg.Pool(config);
  const connect = pool.connect.bind(pool) as () => Promise<pg.PoolClient>;

  const withContext = async (): Promise<pg.PoolClient> => {
    const ctx = currentDbContext();
    const client = await connect();
    try {
      await client.query("SELECT set_config('app.tenant_id', $1, false), set_config('app.bypass_rls', $2, false)", [
        ctx?.system ? '' : (ctx?.tenantId ?? ''),
        ctx?.system ? 'on' : 'off',
      ]);
    } catch (e) {
      client.release(e as Error);
      throw e;
    }
    return client;
  };

  // pg-pool hem söz (await pool.connect()) hem geri çağırma (pool.query içi) biçimini kullanır
  (pool as unknown as { connect: (cb?: ConnectCallback) => Promise<pg.PoolClient> | void }).connect = (cb?: ConnectCallback) => {
    const p = withContext();
    if (!cb) return p;
    p.then(
      (client) => cb(undefined, client, (err?: Error) => client.release(err)),
      (err: Error) => cb(err),
    );
  };
  return pool;
}
