import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { PlatformModule } from './platform/platform.module.js';
import { LoggingModule } from './platform/logging/logging.module.js';
import { SecurityModule } from './platform/security/security.module.js';
import { HealthController } from './platform/health.controller.js';
import { IdentityModule } from './modules/identity/index.js';
import { TaxpayersModule } from './modules/taxpayers/index.js';
import { TaxFilingModule } from './modules/tax-filing/index.js';
import { TebligatModule } from './modules/tebligat/index.js';
import { SocialSecurityModule } from './modules/social-security/index.js';
import { InvoicingModule } from './modules/invoicing/index.js';
import { PayrollModule } from './modules/payroll/index.js';
import { BillingModule } from './modules/billing/index.js';
import { DocumentsModule } from './modules/documents/index.js';
import { AssistantModule } from './modules/assistant/index.js';
import { NotificationsModule } from './modules/notifications/index.js';
import { WorkspaceModule } from './modules/workspace/index.js';
import { DataIntakeModule } from './modules/data-intake/index.js';

/** Ortak altyapı: hem HTTP hem worker süreci kullanır. */
export const coreImports = () => {
  const redis = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return [
    LoggingModule,
    PlatformModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        // Web BFF oturumuna geçene kadar (Faz 3) 8 saat; sonra 15 dk + yenileme anahtarı (docs/adr/0006)
        signOptions: { expiresIn: (process.env.ACCESS_TOKEN_TTL ?? '8h') as `${number}h` },
      }),
    }),
    BullModule.forRoot({
      connection: {
        host: redis.hostname,
        port: Number(redis.port || 6379),
        username: redis.username || undefined,
        password: redis.password ? decodeURIComponent(redis.password) : undefined,
        tls: redis.protocol === 'rediss:' ? {} : undefined,
      },
    }),
  ];
};

/** HTTP süreci (src/main.ts). Kuyruk işleyicisi ve zamanlayıcı KAYDETMEZ; onlar worker'dadır. */
@Module({
  imports: [
    ...coreImports(),
    SecurityModule,
    IdentityModule,
    TaxpayersModule,
    TaxFilingModule,
    TebligatModule,
    SocialSecurityModule,
    InvoicingModule,
    PayrollModule,
    BillingModule,
    DocumentsModule,
    AssistantModule,
    NotificationsModule,
    WorkspaceModule,
    DataIntakeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
