import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './database/prisma.service.js';
import { runAsSystem } from './database/tenant-context.js';

/** Container sağlık kontrolü (Docker healthcheck, ters vekil). Kimlik doğrulama yok, ayrıntı vermez. */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    try {
      await runAsSystem(() => this.prisma.$queryRaw`SELECT 1`);
    } catch {
      throw new ServiceUnavailableException({ status: 'down' });
    }
    return { status: 'ok' };
  }
}
