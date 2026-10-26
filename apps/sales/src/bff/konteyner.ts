import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { GoTrueAuthProvider } from '@eworks/identity-access';
import { databaseSchema, loadConfig, salesSchema, sessionSchema, ShardRouter } from '@eworks/platform';
import {
  NodeSalesCrypto,
  PgDirectory,
  PgSalesAccounts,
  PgSalesAudit,
  PgSalesUsers,
  PgTenantProvisioner,
  RedisLocks,
  RedisSalesSessionStore,
  SvgCaptchaGenerator,
} from '@eworks/sales';

// Satış portalı bağımlılıkları (süreç başına tek örnek; bileşim kökü). Veritabanına `eworks_sales` rolüyle bağlanır: kontrol
// düzleminde yalnız `sales` şeması + ofis açma, shard'larda yalnız hesap açma fonksiyonları (mükellef iş verisi yok).
// GoTrue yönetici uçları yalnız müşavir hesabı açmak için; satış kullanıcılarının kimliği GoTrue'da değildir.

const config = () => ({ ...loadConfig(databaseSchema), ...loadConfig(sessionSchema), ...loadConfig(salesSchema) });

function kur() {
  const c = config();
  const router = ShardRouter.fromUrls(c.CONTROL_DATABASE_URL, c.SHARD_DATABASE_URLS);
  const redis = new Redis(c.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
  const crypto = new NodeSalesCrypto(c.SALES_TOTP_KEY);
  const audit = new PgSalesAudit(router.control);
  const clock = { now: () => new Date() };
  return {
    config: c,
    router,
    redis,
    giris: {
      users: new PgSalesUsers(router.control),
      sessions: new RedisSalesSessionStore(redis),
      crypto,
      captcha: new SvgCaptchaGenerator(),
      audit,
      clock,
      newId: randomUUID,
      csrf: () => randomBytes(24).toString('base64url'),
    },
    ofisler: {
      identity: new GoTrueAuthProvider(c.AUTH_URL, c.JWT_SECRET),
      directory: new PgDirectory(router),
      tenant: new PgTenantProvisioner(router),
      accounts: new PgSalesAccounts(router.control),
      audit,
      locks: new RedisLocks(redis),
      crypto,
      clock,
      newId: randomUUID,
    },
  };
}

export type Konteyner = ReturnType<typeof kur>;

const g = globalThis as { __eworksSatis?: Konteyner };

export const konteyner = (): Konteyner => (g.__eworksSatis ??= kur());
