import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma.service.js';
import { ViziteSyncService } from './vizite-sync.service.js';
import { TescilSyncService } from './tescil-sync.service.js';

export const SGK_QUEUE = 'sgk-sync';

type SyncJob =
  | { name: 'sync-all'; data: { tenantId?: string } }
  | { name: 'sync-workplace'; data: { workplaceId: string; userId?: string | null } };

/**
 * SGK senkron kuyruğu.
 * - Her gece 02:00'de tüm işyerleri sıraya alınır.
 * - Aynı anda en fazla 2 işyeri, dakikada en fazla 20 işyeri işlenir (SGK'yı yormamak için).
 * - Aynı işyeri kuyrukta zaten bekliyorsa tekrar eklenmez (jobId ile).
 */
@Processor(SGK_QUEUE, { concurrency: 2, limiter: { max: 20, duration: 60_000 } })
export class SgkSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SgkSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vizite: ViziteSyncService,
    private readonly tescil: TescilSyncService,
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

  /** Bir büronun (ya da tenantId verilmezse herkesin) bilgileri girilmiş tüm işyerlerini sıraya alır. */
  async enqueueAll(tenantId?: string, userId?: string | null) {
    const workplaces = await this.prisma.sgkWorkplace.findMany({
      where: {
        OR: [{ viziteSecretEnc: { not: null } }, { tescilSystemPasswordEnc: { not: null } }],
        company: { isActive: true, ...(tenantId ? { tenantId } : {}) },
      },
      select: { id: true },
    });
    await this.queue.addBulk(
      workplaces.map((w) => ({
        name: 'sync-workplace',
        data: { workplaceId: w.id, userId: userId ?? null },
        opts: {
          jobId: `sgk-${w.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: true,
          removeOnFail: 200,
        },
      })),
    );
    return workplaces.length;
  }

  /**
   * Bir işyerinin bilgisi girilmiş tüm SGK servislerini çalıştırır. Servisler birbirinden bağımsızdır:
   * biri hata verse de diğeri çalışır. Herhangi biri hata verdiyse iş yeniden denenmek üzere hata fırlatır
   * (senkronlar idempotent olduğu için başarılı servisin tekrar çalışması zararsızdır).
   */
  async syncWorkplace(workplaceId: string, userId: string | null) {
    const wp = await this.prisma.sgkWorkplace.findUniqueOrThrow({
      where: { id: workplaceId },
      select: { viziteSecretEnc: true, tescilSystemPasswordEnc: true },
    });
    const tasks: [string, () => Promise<unknown>][] = [];
    if (wp.viziteSecretEnc) tasks.push(['vizite', () => this.vizite.syncWorkplace(workplaceId, userId)]);
    if (wp.tescilSystemPasswordEnc) tasks.push(['tescil', () => this.tescil.syncWorkplace(workplaceId, userId)]);

    const settled = await Promise.allSettled(tasks.map(([, run]) => run()));
    const result: Record<string, unknown> = {};
    const errors: string[] = [];
    settled.forEach((s, i) => {
      const name = tasks[i][0];
      if (s.status === 'fulfilled') result[name] = s.value;
      else errors.push(`${name}: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`);
    });
    if (errors.length) throw new Error(errors.join(' | '));
    return result;
  }

  async process(job: Job) {
    const { name, data } = job as unknown as SyncJob;
    if (name === 'sync-all') {
      const n = await this.enqueueAll(data.tenantId);
      this.logger.log(`Gece senkronu: ${n} işyeri sıraya alındı`);
      return { queued: n };
    }
    if (name === 'sync-workplace') {
      return this.syncWorkplace(data.workplaceId, data.userId ?? null);
    }
    throw new Error(`Bilinmeyen iş: ${name}`);
  }
}
