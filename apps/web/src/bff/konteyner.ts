import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { PgConsentRepository, PgCredentialRepository } from '@eworks/credentials';
import { PgNoticeRepository } from '@eworks/notices';
import { GoTrueAuthProvider, PgMembershipReader, RedisSessionStore } from '@eworks/identity-access';
import { PgDocumentRepository, S3FileStore } from '@eworks/documents';
import { databaseSchema, Depo, loadConfig, sessionSchema, ShardRouter, storageSchema, taxIdSchema } from '@eworks/platform';
import { PgFirmRepository, PgTaxpayerRegistry, taxIdHasher } from '@eworks/portfolio';
import { PgJobRepository } from '@eworks/sync';
import { PgFilingRepository } from '@eworks/social-security';
import { PgCalendarRepository, PgNoteRepository, PgReminderRepository, PgTaskRepository } from '@eworks/workspace';
import { PgContractRepository, PgDeclarationRepository } from '@eworks/tax-filing';

// BFF bağımlılıkları (süreç başına tek örnek). Yapılandırma açılışta doğrulanır; tarayıcıya hiçbir değer gitmez (D5).

const config = () => ({ ...loadConfig(databaseSchema), ...loadConfig(sessionSchema), ...loadConfig(taxIdSchema), ...loadConfig(storageSchema) });

function kur() {
  const c = config();
  const router = ShardRouter.fromUrls(c.CONTROL_DATABASE_URL, c.SHARD_DATABASE_URLS);
  const redis = new Redis(c.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
  const auth = new GoTrueAuthProvider(c.AUTH_URL, c.JWT_SECRET);
  const members = new PgMembershipReader(router);
  return {
    config: c,
    router,
    redis,
    auth,
    sessions: new RedisSessionStore(redis),
    members,
    ids: { csrf: () => randomBytes(24).toString('base64url') },
    clock: { now: () => new Date() },
    firmalar: { repo: new PgFirmRepository(router), registry: new PgTaxpayerRegistry(router), hashTaxId: taxIdHasher(c.TAX_ID_HMAC_KEY), newId: randomUUID },
    kurumHesaplari: new PgCredentialRepository(router),
    onaylar: new PgConsentRepository(router),
    tebligat: new PgNoticeRepository(router),
    isler: { jobs: new PgJobRepository(router), newId: randomUUID },
    sozlesmeler: { contracts: new PgContractRepository(router) },
    beyannameler: { declarations: new PgDeclarationRepository(router) },
    sgk: { filings: new PgFilingRepository(router) },
    gorevler: {
      tasks: new PgTaskRepository(router),
      // identity-access public API: sorumlu ofisin iç kullanıcısı olmalı
      members: { isStaff: async (ctx: { sub: string; org: string }, id: string) => (await members.staff(ctx.org, ctx.sub)).some((m) => m.userId === id) },
    },
    notlar: { notes: new PgNoteRepository(router) },
    takvim: { repo: new PgCalendarRepository(router) },
    hatirlatmalar: { reminders: new PgReminderRepository(router) },
    belgeler: {
      repo: new PgDocumentRepository(router),
      files: new S3FileStore(new Depo({ endpoint: c.S3_ENDPOINT, bucket: c.S3_BUCKET, accessKey: c.S3_ACCESS_KEY, secretKey: c.S3_SECRET_KEY, region: c.S3_REGION })),
    },
  };
}

export type Konteyner = ReturnType<typeof kur>;

const g = globalThis as { __eworks?: Konteyner };

export const konteyner = (): Konteyner => (g.__eworks ??= kur());
