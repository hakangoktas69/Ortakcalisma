// Satış modülünün müşavir API'siyle (apps/api) paylaştığı çekirdek. Bütün ortak kullanım bu dosyadan geçer:
// şifre özeti ve TOTP aynı olmalı (satışın açtığı müşavir hesabı müşavir sitesinde giriş yapar),
// denetim kaydı aynı zinciri sürdürmeli, Prisma istemcisi tek şemadan üretilir (apps/api/prisma/schema).
// Buraya yalnız saf ya da altyapı yardımcıları eklenir; müşavir API'sinin servis/controller'ları eklenmez.
export { hashPassword, verifyPassword, needsRehash, dummyHash } from '../../../apps/api/src/modules/identity/infrastructure/password-hasher.js';
export {
  generateSecret,
  otpauthUri,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '../../../apps/api/src/modules/identity/domain/totp.js';
export { auditHash } from '../../../apps/api/src/platform/audit/audit-chain.js';
export { PrismaExceptionFilter } from '../../../apps/api/src/platform/http/prisma-exception.filter.js';
export { VaultService, localKeyRing } from '../../../apps/api/src/platform/crypto/vault.service.js';
export * from './core-rules.js';
export { PrismaClient, Prisma } from '../../../apps/api/src/generated/prisma/client.js';
