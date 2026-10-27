// Arka plan işçisi (apps/worker): outbox → RabbitMQ taşıyıcı, entegrasyon sonucu uygulayıcı, takılı iş temizleyici.
// Shard'a işçi rolüyle (eworks_worker) bağlanır; her ofis için sistem bağlamı tek ofisle sınırlıdır (app.is_system).
import { randomUUID } from 'node:crypto';
import { setTimeout as bekle } from 'node:timers/promises';
import { PgCredentialRepository } from '@eworks/credentials';
import { PgDocumentRepository, purgeExpired, retentionDays, S3FileStore } from '@eworks/documents';
import {
  databaseSchema,
  Depo,
  KUYRUKLAR,
  kuyrukBaglan,
  loadConfig,
  messagingSchema,
  ShardRouter,
  storageSchema,
  taxIdSchema,
  withSystem,
  yayimla,
  type Kanal,
} from '@eworks/platform';
import { PgFirmRepository, PgTaxpayerRegistry, taxIdHasher } from '@eworks/portfolio';
import { failStaleJobs, PgJobRepository, requestCalendarJob } from '@eworks/sync';
import { PgFilingRepository } from '@eworks/social-security';
import { PgContractRepository, PgDeclarationRepository } from '@eworks/tax-filing';
import { PgNoticeRepository } from '@eworks/notices';
import { applyCalendarSources, BundledCalendarSources, ensureCalendarYear, PgCalendarRepository } from '@eworks/workspace';
import { eksikleriTamamla, ortakAnahtar, takvimHazirla, takvimYillari, type OrtakTakvim } from './takvim.ts';
import { sonucuIsle, type UygulayiciDeps } from './uygulayici.ts';

const SIFIR = '00000000-0000-0000-0000-000000000000';
const gunluk = (olay: string, ek: Record<string, unknown> = {}) => console.log(JSON.stringify({ zaman: new Date().toISOString(), olay, ...ek }));

/** Outbox'taki bekleyen mesajları yayımlar; yalnız sunucu onayından sonra "yayımlandı" işaretler (en az bir kez teslim). */
export async function outboxTasi(router: ShardRouter, ch: Kanal): Promise<number> {
  let toplam = 0;
  for (const shard of router.shardIds) {
    const pool = router.pool(shard);
    const satirlar = await withSystem(pool, SIFIR, async (c) =>
      (await c.query<{ org_id: string; id: string; topic: string; payload: unknown }>('select * from sync.pending_outbox(100)')).rows,
    );
    if (satirlar.length === 0) continue;
    // Shard kimliği mesaja eklenir: ACL kontrol düzlemine erişmeden doğru shard'a bağlanır (en az yetki)
    for (const s of satirlar) await yayimla(ch, s.topic, { ...(s.payload as object), shard });
    await withSystem(pool, SIFIR, (c) => c.query('select sync.mark_published($1::uuid[], $2::bigint[])', [satirlar.map((s) => s.org_id), satirlar.map((s) => s.id)]));
    toplam += satirlar.length;
  }
  return toplam;
}

export async function main(env = process.env) {
  const db = loadConfig(databaseSchema, env);
  const mq = loadConfig(messagingSchema, env);
  const st = loadConfig(storageSchema, env);
  const tx = loadConfig(taxIdSchema, env);
  const router = ShardRouter.fromUrls(db.CONTROL_DATABASE_URL, db.SHARD_DATABASE_URLS);
  const depo = new Depo({ endpoint: st.S3_ENDPOINT, bucket: st.S3_BUCKET, accessKey: st.S3_ACCESS_KEY, secretKey: st.S3_SECRET_KEY, region: st.S3_REGION });
  await depo.hazirla();
  const { conn, ch } = await kuyrukBaglan(mq.RABBITMQ_URL);
  const deps: UygulayiciDeps = {
    jobs: new PgJobRepository(router),
    creds: new PgCredentialRepository(router),
    firmalar: { repo: new PgFirmRepository(router), registry: new PgTaxpayerRegistry(router), hashTaxId: taxIdHasher(tx.TAX_ID_HMAC_KEY), newId: randomUUID },
    sozlesmeler: new PgContractRepository(router),
    beyannameler: new PgDeclarationRepository(router),
    belgeler: new PgDocumentRepository(router),
    sgk: new PgFilingRepository(router),
    sonucOku: (k) => depo.json(k),
    sonucSil: (k) => depo.sil(k),
    takvim: { repo: new PgCalendarRepository(router) },
    takvimOrtak: { kaydet: (o) => depo.koy(ortakAnahtar(o.year), JSON.stringify(o), 'application/json') },
    tebligat: new PgNoticeRepository(router),
  };
  let calisiyor = true;
  const dur = () => {
    calisiyor = false;
  };
  process.on('SIGTERM', dur);
  process.on('SIGINT', dur);

  await ch.consume(KUYRUKLAR.sonuc, async (msg) => {
    if (!msg) return;
    try {
      const sonuc = await sonucuIsle(JSON.parse(msg.content.toString('utf8')), deps);
      gunluk('sonuc', { sonuc });
      ch.ack(msg);
    } catch (e) {
      // Kişisel veri ve kurum yanıtı günlüğe yazılmaz; yalnız hata türü
      gunluk('sonuc_hatasi', { hata: (e as Error).name, mesaj: (e as Error).message.slice(0, 120) });
      ch.nack(msg, false, false);
    }
  });
  gunluk('isci_basladi', { shardlar: router.shardIds });

  let sonTemizlik = 0;
  let sonBelgeTemizligi = 0;
  let sonTakvim = 0;
  const takvim = { repo: new PgCalendarRepository(router), sources: new BundledCalendarSources() };
  const takvimBellegi = new Map<number, Set<string>>();
  const saklamaGunu = retentionDays(env.DOCUMENT_RETENTION_DAYS);
  const dosyalar = new S3FileStore(depo);
  while (calisiyor) {
    try {
      const n = await outboxTasi(router, ch);
      if (n) gunluk('outbox', { yayimlanan: n });
      if (Date.now() - sonTemizlik > 60_000) {
        sonTemizlik = Date.now();
        const { rows } = await router.control.query<{ id: string }>(`select id from directory.organizations where status = 'active'`);
        for (const o of rows) {
          const n2 = await failStaleJobs({ org: o.id }, { jobs: deps.jobs });
          if (n2) gunluk('takili_is', { adet: n2 });
        }
      }
      // D15: süresi dolan PDF dosyaları saatte bir silinir (satırlar kalır)
      if (Date.now() - sonBelgeTemizligi > 3_600_000) {
        sonBelgeTemizligi = Date.now();
        const { rows } = await router.control.query<{ id: string }>(`select id from directory.organizations where status = 'active'`);
        for (const o of rows) {
          const n3 = await purgeExpired({ org: o.id }, { repo: deps.belgeler, files: dosyalar }, saklamaGunu);
          if (n3) gunluk('belge_temizligi', { adet: n3, gun: saklamaGunu });
        }
      }
      // Takvim: her ofisin yılı hazır kaynaktan doldurulur (başlangıçta ve 10 dakikada bir; idempotent, dolu yıl yazılmaz)
      if (Date.now() - sonTakvim > 600_000) {
        sonTakvim = Date.now();
        const { rows } = await router.control.query<{ id: string }>(`select id from directory.organizations where status = 'active'`);
        const t = await takvimHazirla(rows.map((o) => o.id), takvimYillari(new Date()), (org, yil) => ensureCalendarYear({ org }, yil, takvim));
        if (t.yazilan || t.hata || t.gibEksik.length) gunluk('takvim', { yazilan: t.yazilan, gib_eksik: t.gibEksik.length, hata: t.hata });
        // GİB vergi takvimi eksik yıl: kamuya açık veri yıl başına bir kez çekilir (ortak sonuç), ofislerin kopyası ondan doldurulur
        const e = await eksikleriTamamla(t.gibEksik, new Date(), {
          ortakOku: (yil) => depo.json<OrtakTakvim>(ortakAnahtar(yil), 2 * 1024 * 1024).catch(() => null),
          uygula: async (org, yil, kaynak) => {
            const r = await applyCalendarSources({ org }, yil, kaynak, takvim);
            if (!r.ok) throw new Error(r.error);
          },
          iste: async (org, yil) => void (await requestCalendarJob({ org }, yil, { jobs: deps.jobs, newId: randomUUID }, new Date())),
          bellek: takvimBellegi,
        });
        if (e.uygulanan || e.istenen) gunluk('takvim_ortak', e);
      }
    } catch (e) {
      gunluk('dongu_hatasi', { hata: (e as Error).name });
    }
    await bekle(1000);
  }
  await ch.close();
  await conn.close();
  await router.end();
}

if (process.argv[1]?.endsWith('main.ts')) {
  main().catch((e: Error) => {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  });
}
