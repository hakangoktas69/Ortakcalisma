import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SalesAuthService } from './application/auth.service.js';
import { OfficesService } from './application/offices.service.js';
import { TeamService } from './application/team.service.js';
import { config } from './config.js';
import { localKeyRing, rateLimitMessage, VaultService } from './core.js';
import { SalesAuditService } from './infrastructure/audit.service.js';
import { PrismaService } from './infrastructure/prisma.service.js';
import { AuthController } from './interface/http/auth.controller.js';
import { HealthController } from './interface/http/health.controller.js';
import { OfficesController } from './interface/http/offices.controller.js';
import { SalesSessionGuard } from './interface/http/session.js';
import { TeamController } from './interface/http/team.controller.js';

@Module({
  imports: [
    JwtModule.registerAsync({ useFactory: () => ({ secret: config().JWT_SECRET }) }),
    // Tek süreç (satış ekibi küçük): sayaç bellekte. Giriş uçları ayrıca dakikada 10 istekle sınırlı.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', limit: 300, ttl: 60_000 }],
      skipIf: () => config().RATE_LIMIT === 'off',
      errorMessage: (_ctx, detail) => rateLimitMessage(detail),
    }),
  ],
  controllers: [AuthController, OfficesController, TeamController, HealthController],
  providers: [
    PrismaService,
    SalesAuditService,
    // Satışın kendi anahtarı (SATIS_VAULT_KEY → VAULT_KEY): müşavir API'sinin şifrelediği veriyi çözemez
    { provide: VaultService, useFactory: () => new VaultService(localKeyRing(config().VAULT_KEY)) },
    SalesAuthService,
    OfficesService,
    TeamService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SalesSessionGuard },
  ],
})
export class AppModule {}
