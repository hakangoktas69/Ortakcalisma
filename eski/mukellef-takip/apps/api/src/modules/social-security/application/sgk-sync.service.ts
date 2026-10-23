import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { ViziteSyncService } from './vizite-sync.service.js';
import { TescilSyncService } from './tescil-sync.service.js';

export const SGK_QUEUE = 'sgk-sync';

export type SyncJob =
  | { name: 'sync-all'; data: { tenantId?: string } }
  | { name: 'sync-workplace'; data: { workplaceId: string; userId?: string | null } };

/**
 * SGK senkronunun kullanım senaryoları. Kuyruğa alma API'de de çalışır; işleri yalnız worker süreci
 * işler (infrastructure/sgk-sync.processor.ts).
 */
@Injectable()
export class SgkSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vizite: ViziteSyncService,
    private readonly tescil: TescilSyncService,
    @InjectQueue(SGK_QUEUE) private readonly queue: Queue,
  ) {}

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
}
