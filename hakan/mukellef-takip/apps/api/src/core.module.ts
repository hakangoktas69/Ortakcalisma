import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { VaultService } from './vault/vault.service.js';
import { AuditService } from './audit.service.js';
import { ApiTokenService } from './auth/api-token.service.js';

// Uygulama genelinde tek örnek olması gereken servisler (tek veritabanı bağlantı havuzu).
@Global()
@Module({
  providers: [PrismaService, VaultService, AuditService, ApiTokenService],
  exports: [PrismaService, VaultService, AuditService, ApiTokenService],
})
export class CoreModule {}
