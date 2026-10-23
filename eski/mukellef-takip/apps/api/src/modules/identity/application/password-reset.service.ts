import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { appConfig } from '../../../platform/config/config.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { AuditService } from '../../../platform/audit/audit.service.js';
import { runAsSystem } from '../../../platform/database/tenant-context.js';
import {
  canSendCode,
  checkResetCode,
  generateResetCode,
  hashResetCode,
  maskTarget,
  parseIdentifier,
  RESET_CODE_TTL_MINUTES,
  type ResetIdentifier,
} from '../domain/password-reset.js';
import { hashPassword } from '../infrastructure/password-hasher.js';
import { ResetCodeSender } from '../infrastructure/reset-code.sender.js';
import { checkPasswordPolicy } from './auth.service.js';

const INVALID_CODE = 'Kod hatalı ya da süresi dolmuş. Yeni kod isteyin.';

/**
 * "Şifremi unuttum". Oturumsuz çalışır (büro henüz bilinmiyor): sorgular sistem bağlamında, yalnız ilgili kullanıcıya dokunur.
 * - Kayıtlı olup olmadığı belli edilmez: istek yanıtı her durumda aynıdır.
 * - Şifre değişince açık oturumlar düşer; iki adımlı doğrulama açıksa girişte yine istenir (kod, 2FA'nın yerine geçmez).
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sender: ResetCodeSender,
  ) {}

  private assertEnabled() {
    if (!this.sender.enabled) throw new ServiceUnavailableException('Şifre sıfırlama şu anda kapalı. Büronuzun yöneticisinden şifre sıfırlamasını isteyin.');
  }

  private parse(identifier: string): ResetIdentifier {
    const id = parseIdentifier(identifier);
    if (!id) throw new BadRequestException('Geçerli bir e-posta adresi ya da cep telefonu numarası yazın');
    return id;
  }

  /** Tek kullanıcıya karşılık geliyorsa onu döner. Aynı telefon birden fazla hesapta kayıtlıysa telefonla sıfırlama yapılmaz. */
  private async findUser(id: ResetIdentifier) {
    const select = {
      id: true,
      tenantId: true,
      isActive: true,
      passwordResetHash: true,
      passwordResetExpires: true,
      passwordResetAttempts: true,
      passwordResetSentAt: true,
    } as const;
    if (id.kind === 'email') return this.prisma.user.findUnique({ where: { email: id.value }, select });
    const users = await this.prisma.user.findMany({ where: { phone: id.value }, select, take: 2 });
    return users.length === 1 ? users[0] : null;
  }

  request(identifier: string) {
    this.assertEnabled();
    const id = this.parse(identifier);
    return runAsSystem(async () => {
      const u = await this.findUser(id);
      let devCode: string | undefined;
      if (u?.isActive && canSendCode(u)) {
        const code = generateResetCode();
        const now = new Date();
        await this.prisma.user.update({
          where: { id: u.id },
          data: {
            passwordResetHash: hashResetCode(appConfig().JWT_SECRET, u.id, code),
            passwordResetExpires: new Date(now.getTime() + RESET_CODE_TTL_MINUTES * 60_000),
            passwordResetAttempts: 0,
            passwordResetSentAt: now,
          },
        });
        await this.sender.send(id, code);
        await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.password.reset.request', detail: { channel: id.kind } });
        // Deneme modunda kod gitmediği için geliştirme ekranında gösterilir (üretimde mock zaten açılmaz)
        if (this.sender.mode === 'mock' && appConfig().NODE_ENV !== 'production') devCode = code;
      }
      return { sent: true, channel: id.kind, to: maskTarget(id), ttlMinutes: RESET_CODE_TTL_MINUTES, ...(devCode ? { devCode } : {}) };
    });
  }

  confirm(identifier: string, code: string, newPassword: string) {
    this.assertEnabled();
    const id = this.parse(identifier);
    checkPasswordPolicy(newPassword);
    return runAsSystem(async () => {
      const u = await this.findUser(id);
      if (!u || !u.isActive) throw new BadRequestException(INVALID_CODE);
      const result = checkResetCode(u, hashResetCode(appConfig().JWT_SECRET, u.id, code.replace(/\s/g, '')));
      if (result === 'wrong') await this.prisma.user.update({ where: { id: u.id }, data: { passwordResetAttempts: { increment: 1 } } });
      if (result !== 'ok') throw new BadRequestException(INVALID_CODE);
      await this.prisma.user.update({
        where: { id: u.id },
        data: {
          passwordHash: await hashPassword(newPassword),
          mustChangePassword: false,
          // Açık oturumlar ve yenileme anahtarları geçersizleşir; hesap kilidi kalkar
          sessionVersion: { increment: 1 },
          failedLogins: 0,
          lockedUntil: null,
          passwordResetHash: null,
          passwordResetExpires: null,
          passwordResetAttempts: 0,
        },
      });
      await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.password.reset', detail: { channel: id.kind } });
      return { ok: true };
    });
  }
}
