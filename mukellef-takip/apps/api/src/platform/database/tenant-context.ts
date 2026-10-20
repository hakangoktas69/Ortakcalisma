import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * İstek / iş başına veritabanı bağlamı. PostgreSQL RLS politikaları bu değerleri okur (docs/adr/0004).
 * - tenantId: giriş yapan kullanıcının bürosu; yalnız o büronun satırları görünür.
 * - system: büro bağımsız, güvenilir kod (giriş, oturum doğrulama, zamanlanmış işler); RLS atlanır.
 * Bağlam yoksa ya da tenantId boşsa hiçbir tenant satırı görünmez (fail-closed).
 */
export interface DbContext {
  tenantId?: string;
  system?: boolean;
}

const storage = new AsyncLocalStorage<DbContext>();

/** HTTP isteğinin tamamını değiştirilebilir bir bağlamla sarar; AuthGuard tenantId'yi sonradan yazar. */
export function runWithDbContext<T>(fn: () => T, ctx: DbContext = {}): T {
  return storage.run(ctx, fn);
}

/** Mevcut isteğin bürosunu belirler (oturum doğrulandıktan sonra). */
export function setCurrentTenant(tenantId: string) {
  const ctx = storage.getStore();
  if (!ctx) throw new Error('Veritabanı bağlamı yok: istek runWithDbContext ile sarılmamış');
  ctx.tenantId = tenantId;
}

/**
 * Prisma sorguları tembeldir (PrismaPromise): `.then` çağrılana kadar çalışmaz. fn bir sorgu döndürürse
 * `.then` burada, bağlamın İÇİNDE çağrılır; aksi hâlde sorgu çağıranın `await`'inde bağlam dışında başlardı.
 */
function runIn<T>(ctx: DbContext, fn: () => T): T {
  return storage.run(ctx, () => {
    const r = fn();
    if (r && typeof (r as { then?: unknown }).then === 'function') {
      const thenable = r as unknown as PromiseLike<unknown>;
      return new Promise((resolve, reject) => thenable.then(resolve, reject)) as T;
    }
    return r;
  });
}

/** fn içindeki sorgular RLS'i atlar. Yalnız büroyu henüz bilmeyen güvenilir kod yollarında kullan. */
export function runAsSystem<T>(fn: () => T): T {
  return runIn({ system: true }, fn);
}

/** fn içindeki sorgular verilen büroyla sınırlanır (ör. zamanlanmış işin büro döngüsü). */
export function runAsTenant<T>(tenantId: string, fn: () => T): T {
  return runIn({ tenantId }, fn);
}

export function currentDbContext(): DbContext | undefined {
  return storage.getStore();
}
