import { Global, Module } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';
import { VaultService } from './crypto/vault.service.js';
import { loadKeyRing, startOpenBaoTokenRenewal } from './crypto/kms.js';
import { PersonalDataService } from './crypto/personal-data.js';
import { AuditService } from './audit/audit.service.js';
import { OutboxService } from './events/outbox.service.js';
import { appConfig } from './config/config.js';

/**
 * Uygulama genelinde tek örnek olması gereken teknik servisler (tek veritabanı havuzu, tek anahtar halkası).
 * İş kuralı içermez; context'ler bu servisleri kullanır.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: VaultService,
      useFactory: async () => {
        const ring = await loadKeyRing(appConfig());
        startOpenBaoTokenRenewal(appConfig());
        return new VaultService(ring);
      },
    },
    PersonalDataService,
    AuditService,
    OutboxService,
  ],
  exports: [PrismaService, VaultService, PersonalDataService, AuditService, OutboxService],
})
export class PlatformModule {}
