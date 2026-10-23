import { Injectable } from '@nestjs/common';
import { auditHash, type Prisma } from '../core.js';
import { PrismaService } from './prisma.service.js';

type Tx = Prisma.TransactionClient;

/** Satış zincirinin hash'inde büro alanı yerine kullanılan sabit (büro zincirleriyle karışmaz). */
export const SALES_CHAIN = 'satis';

export interface SalesAuditEntry {
  salesUserId: string | null;
  action: string;
  target?: string;
  /** Kişisel verinin kendisi yazılmaz; kimlik/tür/sayı yazılır. */
  detail?: Prisma.InputJsonValue;
}

/**
 * Satış işlem kaydı. İki zincir:
 * - SalesAuditLog: satış ekibinin tüm işlemleri (giriş, kullanıcı, büro).
 * - Büronun AuditLog'u: büroyu etkileyen işlem müşavirin kendi kaydında da görünür (userId boş, detail.salesUserId).
 * Zincir algoritması ve danışma kilidi müşavir API'siyle aynıdır (apps/api platform/audit), aynı zinciri sürdürür.
 */
@Injectable()
export class SalesAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Yalnız satış zincirine yazar. */
  log(entry: SalesAuditEntry) {
    return this.prisma.$transaction((tx) => this.append(tx, entry));
  }

  /** Büroyu etkileyen işlem: satış zinciri + büro zinciri, tek transaction içinde. */
  async logOffice(tx: Tx, tenantId: string, entry: SalesAuditEntry) {
    await this.append(tx, { ...entry, target: tenantId });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'audit:' + tenantId}))`;
    const prev = await tx.auditLog.findFirst({ where: { tenantId, hash: { not: null } }, orderBy: { seq: 'desc' }, select: { hash: true } });
    const createdAt = new Date();
    const prevHash = prev?.hash ?? null;
    const detail = { ...(entry.detail as Record<string, unknown> | undefined), salesUserId: entry.salesUserId } as Prisma.InputJsonValue;
    const row = { tenantId, userId: null, action: entry.action, target: tenantId, detail };
    await tx.auditLog.create({ data: { ...row, createdAt, prevHash, hash: auditHash(prevHash, { ...row, createdAt }) } });
  }

  private async append(tx: Tx, entry: SalesAuditEntry) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'audit:' + SALES_CHAIN}))`;
    const prev = await tx.salesAuditLog.findFirst({ where: { hash: { not: null } }, orderBy: { seq: 'desc' }, select: { hash: true } });
    const createdAt = new Date();
    const prevHash = prev?.hash ?? null;
    const hash = auditHash(prevHash, { tenantId: SALES_CHAIN, userId: entry.salesUserId, action: entry.action, target: entry.target, detail: entry.detail, createdAt });
    await tx.salesAuditLog.create({ data: { ...entry, createdAt, prevHash, hash } });
  }
}
