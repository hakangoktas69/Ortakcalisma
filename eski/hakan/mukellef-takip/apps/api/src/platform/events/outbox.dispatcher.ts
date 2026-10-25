import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service.js';
import { runAsSystem, runAsTenant } from '../database/tenant-context.js';
import { DOMAIN_EVENT_HANDLER, type DomainEvent } from './outbox.service.js';

type Handler = (event: DomainEvent) => Promise<unknown> | unknown;

const BATCH = 20;
const POLL_MS = 1000;
const MAX_BACKOFF_MS = 60 * 60_000;
/** İşlenmiş olaylar bu süre sonra silinir (olay yükü kişisel veri içerebilir: veri minimizasyonu). */
const RETENTION_DAYS = 7;

export function backoffMs(attempts: number) {
  return Math.min(MAX_BACKOFF_MS, 2 ** Math.max(0, attempts - 1) * 15_000);
}

/**
 * Worker sürecinde outbox tablosunu tarar ve olayları abonelere iletir.
 * Birden fazla worker güvenle çalışır: satırlar FOR UPDATE SKIP LOCKED ile kiralanır.
 */
@Injectable()
export class OutboxDispatcher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private readonly handlers = new Map<string, Handler[]>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastCleanup = 0;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap() {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || typeof instance !== 'object') continue;
      const proto = Object.getPrototypeOf(instance);
      for (const name of this.scanner.getAllMethodNames(proto)) {
        const type = this.reflector.get<string | undefined>(DOMAIN_EVENT_HANDLER, proto[name]);
        if (!type) continue;
        const list = this.handlers.get(type) ?? [];
        list.push((e) => (instance[name] as Handler).call(instance, e));
        this.handlers.set(type, list);
      }
    }
    this.logger.log(`Olay aboneleri: ${[...this.handlers.keys()].join(', ') || '(yok)'}`);
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      while ((await this.dispatchBatch()) === BATCH);
      if (Date.now() - this.lastCleanup > 3_600_000) await this.cleanup();
    } catch (e) {
      this.logger.error(`Outbox taraması başarısız: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Bekleyen olayları kiralar ve işler; işlenen sayısını döner. */
  async dispatchBatch(): Promise<number> {
    const rows = await runAsSystem(
      () => this.prisma.$queryRaw<{ id: string; tenantId: string; type: string; payload: DomainEvent['payload']; attempts: number }[]>`
        UPDATE "OutboxEvent" SET "attempts" = "attempts" + 1, "availableAt" = now() + interval '5 minutes'
        WHERE id IN (
          SELECT id FROM "OutboxEvent"
          WHERE "processedAt" IS NULL AND "availableAt" <= now()
          ORDER BY "createdAt" LIMIT ${BATCH}
          FOR UPDATE SKIP LOCKED)
        RETURNING id, "tenantId", type, payload, attempts`,
    );
    for (const row of rows) {
      const handlers = this.handlers.get(row.type) ?? [];
      try {
        // Abone yalnız olayın bürosunu görür
        for (const h of handlers) await runAsTenant(row.tenantId, () => h({ id: row.id, type: row.type, tenantId: row.tenantId, payload: row.payload }));
        await runAsSystem(() => this.prisma.outboxEvent.update({ where: { id: row.id }, data: { processedAt: new Date(), lastError: null } }));
      } catch (e) {
        const message = (e as Error).message ?? String(e);
        this.logger.warn(`Olay ${row.type} (${row.id}) işlenemedi, deneme ${row.attempts}: ${message}`);
        await runAsSystem(() =>
          this.prisma.outboxEvent.update({
            where: { id: row.id },
            data: { availableAt: new Date(Date.now() + backoffMs(row.attempts)), lastError: message.slice(0, 500) },
          }),
        );
      }
    }
    return rows.length;
  }

  private async cleanup() {
    this.lastCleanup = Date.now();
    const before = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    await runAsSystem(() => this.prisma.outboxEvent.deleteMany({ where: { processedAt: { lt: before } } }));
  }
}
