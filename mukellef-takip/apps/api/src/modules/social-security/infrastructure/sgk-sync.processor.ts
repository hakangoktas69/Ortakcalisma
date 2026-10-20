import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { runAsSystem } from '../../../platform/database/tenant-context.js';
import { SGK_QUEUE, SgkSyncService, type SyncJob } from '../application/sgk-sync.service.js';

/**
 * SGK senkron kuyruğu (yalnız worker süreci).
 * - Her gece 02:00'de tüm işyerleri sıraya alınır.
 * - Aynı anda en fazla 2 işyeri, dakikada en fazla 20 işyeri işlenir (SGK'yı yormamak için).
 * - Aynı işyeri kuyrukta zaten bekliyorsa tekrar eklenmez (jobId ile).
 */
@Processor(SGK_QUEUE, { concurrency: 2, limiter: { max: 20, duration: 60_000 } })
export class SgkSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SgkSyncProcessor.name);

  constructor(
    private readonly sync: SgkSyncService,
    @InjectQueue(SGK_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'nightly-sgk-sync',
      { pattern: '0 2 * * *', tz: 'Europe/Istanbul' },
      { name: 'sync-all', data: {} },
    );
  }

  // Zamanlanmış iş büro bağımsızdır: sistem bağlamında çalışır, sorgular tenantId'yi açıkça kullanır
  process(job: Job) {
    return runAsSystem(async () => {
      const { name, data } = job as unknown as SyncJob;
      if (name === 'sync-all') {
        const n = await this.sync.enqueueAll(data.tenantId);
        this.logger.log(`Gece senkronu: ${n} işyeri sıraya alındı`);
        return { queued: n };
      }
      if (name === 'sync-workplace') return this.sync.syncWorkplace(data.workplaceId, data.userId ?? null);
      throw new Error(`Bilinmeyen iş: ${name}`);
    });
  }
}
