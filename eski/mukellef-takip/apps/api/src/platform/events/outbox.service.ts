import { Injectable, SetMetadata } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Context'ler arası olay (docs/adr/0003). Tip adı "<context>.<olay>" biçimindedir; yük yalnız JSON
 * değerler içerir ve abonenin işini yapması için yeterli olmalıdır (abone yayıncının tablosunu okumaz).
 */
export interface DomainEvent<T extends Prisma.InputJsonValue = Prisma.InputJsonValue> {
  /** Outbox satır kimliği (abonede dolu): idempotentlik anahtarı olarak kullanılabilir */
  id?: string;
  type: string;
  tenantId: string;
  payload: T;
}

/** Bir transaction istemcisi ya da PrismaService: olay, komutun kendi verisiyle aynı transaction'da yazılmalı. */
type Db = Pick<PrismaService, 'outboxEvent'> | Prisma.TransactionClient;

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  publish(event: DomainEvent, db: Db = this.prisma) {
    return db.outboxEvent.create({ data: { tenantId: event.tenantId, type: event.type, payload: event.payload } });
  }

  publishAll(events: DomainEvent[], db: Db = this.prisma) {
    if (!events.length) return Promise.resolve({ count: 0 });
    return db.outboxEvent.createMany({ data: events.map((e) => ({ tenantId: e.tenantId, type: e.type, payload: e.payload })) });
  }
}

export const DOMAIN_EVENT_HANDLER = 'mukellef:domain-event-handler';

/**
 * Bir sağlayıcı metodunu olay abonesi yapar: `@OnDomainEvent('tebligat.imported') handle(e: DomainEvent<...>)`.
 * Abone worker sürecinde, olayın bürosunun RLS bağlamında çalışır ve idempotent olmalıdır (en az bir kez teslim).
 */
export const OnDomainEvent = (type: string) => SetMetadata(DOMAIN_EVENT_HANDLER, type);
