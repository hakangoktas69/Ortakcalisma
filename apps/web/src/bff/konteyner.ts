import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { PgCredentialRepository } from '@eworks/credentials';
import { GoTrueAuthProvider, PgMembershipReader, RedisSessionStore } from '@eworks/identity-access';
import { databaseSchema, loadConfig, sessionSchema, ShardRouter, taxIdSchema } from '@eworks/platform';
import { PgFirmRepository, PgTaxpayerRegistry, taxIdHasher } from '@eworks/portfolio';
import { PgJobRepository } from '@eworks/sync';
import { PgContractRepository } from '@eworks/tax-filing';

// BFF bağımlılıkları (süreç başına tek örnek). Yapılandırma açılışta doğrulanır; tarayıcıya hiçbir değer gitmez (D5).

const config = () => ({ ...loadConfig(databaseSchema), ...loadConfig(sessionSchema), ...loadConfig(taxIdSchema) });

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
    firmalar: { repo: new PgFirmRepository(router), registry: new PgTaxpayerRegistry(router), hashTaxId: taxIdHasher(c.TAX_ID_HMAC_KEY), newId: randomUUID },
    kurumHesaplari: new PgCredentialRepository(router),
    isler: { jobs: new PgJobRepository(router), newId: randomUUID },
    sozlesmeler: { contracts: new PgContractRepository(router) },
  };
}

export type Konteyner = ReturnType<typeof kur>;

const g = globalThis as { __eworks?: Konteyner };

export const konteyner = (): Konteyner => (g.__eworks ??= kur());
