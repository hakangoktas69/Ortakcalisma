import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { auditHash, verifyAuditChain } from './audit-chain.js';

export interface AuditEntry {
  tenantId: string;
  userId?: string | null;
  action: string;
  target?: string;
  /** Kişisel verinin kendisi yazılmaz; kimlik/tür/sayı yazılır (docs/ai/security-kvkk.md). */
  detail?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Kaydı büronun hash zincirine ekler. Aynı büroya eşzamanlı yazımlar danışma kilidiyle sıraya girer;
   * böylece zincir çatallanmaz.
   */
  log(entry: AuditEntry) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'audit:' + entry.tenantId}))`;
      const prev = await tx.auditLog.findFirst({
        where: { tenantId: entry.tenantId, hash: { not: null } },
        orderBy: { seq: 'desc' },
        select: { hash: true },
      });
      const createdAt = new Date();
      const prevHash = prev?.hash ?? null;
      return tx.auditLog.create({
        data: { ...entry, createdAt, prevHash, hash: auditHash(prevHash, { ...entry, createdAt }) },
      });
    });
  }

  /** Büronun denetim kaydı zincirini baştan doğrular (yönetici / periyodik kontrol). */
  async verify(tenantId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { seq: 'asc' },
      select: { id: true, tenantId: true, userId: true, action: true, target: true, detail: true, createdAt: true, prevHash: true, hash: true },
    });
    return { ...verifyAuditChain(rows), count: rows.length };
  }
}
