import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../infrastructure/prisma.service.js';
import { Public } from './session.js';

/** Container sağlık denetimi: süreç ayakta ve veritabanına bağlanabiliyor mu. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Veritabanına ulaşılamıyor');
    }
    return { ok: true };
  }
}
