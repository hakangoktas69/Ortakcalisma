import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import type { Prisma } from './generated/prisma/client.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: {
    tenantId: string;
    userId?: string | null;
    action: string;
    target?: string;
    detail?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({ data: entry });
  }
}
