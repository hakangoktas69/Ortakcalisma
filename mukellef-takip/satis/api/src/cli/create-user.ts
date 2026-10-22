// İlk satış kullanıcısını (ya da portala giremeyen ekipte yeni birini) komut satırından açar.
// Sonraki kullanıcılar portalın "Satış ekibi" ekranından eklenir.
//   Geliştirme:  npm run satis:kullanici -- ad.soyad@firma.com "Ad Soyad"
//   Docker:      docker compose … exec satis-api node dist/satis/api/src/cli/create-user.js ad.soyad@firma.com "Ad Soyad"
// Geçici şifre yalnız ekrana bir kez yazılır; ilk girişte iki adımlı doğrulama kurulur ve şifre değiştirilir.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadConfig } from '../config.js';
import { hashPassword, PrismaClient } from '../core.js';
import { generateTempPassword } from '../domain/password.js';
import { SalesAuditService } from '../infrastructure/audit.service.js';
import type { PrismaService } from '../infrastructure/prisma.service.js';

const [email, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(' ').trim();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || fullName.length < 2) {
  console.error('Kullanım: create-user <e-posta> "Ad Soyad" (geliştirmede: npm run satis:kullanici -- …; bkz. satis/README.md)');
  process.exit(1);
}

const c = loadConfig();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: c.DATABASE_URL }) });
try {
  const normalized = email.toLowerCase();
  if (await prisma.salesUser.findUnique({ where: { email: normalized } })) {
    console.error('Bu e-posta ile bir satış kullanıcısı zaten var. Şifresini portaldan bir ekip arkadaşı sıfırlayabilir.');
    process.exit(1);
  }
  const tempPassword = generateTempPassword();
  const u = await prisma.salesUser.create({ data: { email: normalized, fullName, passwordHash: await hashPassword(tempPassword) } });
  await new SalesAuditService(prisma as PrismaService).log({ salesUserId: null, action: 'sales.user.create.cli', target: u.id });
  console.log(`Satış kullanıcısı açıldı: ${normalized}\nGeçici şifre (bir kez gösterilir): ${tempPassword}`);
} finally {
  await prisma.$disconnect();
}
