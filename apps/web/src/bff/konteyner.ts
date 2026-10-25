import 'server-only';
import { randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';
import { GoTrueAuthProvider, PgMembershipReader, RedisSessionStore } from '@eworks/identity-access';
import { databaseSchema, loadConfig, sessionSchema, ShardRouter } from '@eworks/platform';

// BFF bağımlılıkları (süreç başına tek örnek). Yapılandırma açılışta doğrulanır; tarayıcıya hiçbir değer gitmez (D5).

const config = () => ({ ...loadConfig(databaseSchema), ...loadConfig(sessionSchema) });

function kur() {
  const c = config();
  const router = ShardRouter.fromUrls(c.CONTROL_DATABASE_URL, c.SHARD_DATABASE_URLS);
  const redis = new Redis(c.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
  const auth = new GoTrueAuthProvider(c.AUTH_URL, c.JWT_SECRET);
  return {
    config: c,
    router,
    redis,
    auth,
    sessions: new RedisSessionStore(redis),
    members: new PgMembershipReader(router),
    ids: { csrf: () => randomBytes(24).toString('base64url') },
    clock: { now: () => new Date() },
  };
}

export type Konteyner = ReturnType<typeof kur>;

const g = globalThis as { __eworks?: Konteyner };

export const konteyner = (): Konteyner => (g.__eworks ??= kur());
