import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword } from '../core.js';
import { generateTempPassword } from '../domain/password.js';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { SalesAuditService } from '../infrastructure/audit.service.js';

const teamSelect = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  mustChangePassword: true,
  totpEnabledAt: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
} as const;

/**
 * Satış ekibi kullanıcıları. Tek yetki seviyesi: her satış kullanıcısı ekip arkadaşı ekleyebilir.
 * Yeni kullanıcıya geçici şifre verilir; ilk girişte iki adımlı doğrulama kurar ve şifresini değiştirir.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: SalesAuditService,
  ) {}

  async list(meId: string) {
    const users = await this.prisma.salesUser.findMany({ select: teamSelect, orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }] });
    const now = new Date();
    return users.map(({ totpEnabledAt, lockedUntil, ...u }) => ({
      ...u,
      twoFactorEnabled: !!totpEnabledAt,
      locked: !!lockedUntil && lockedUntil > now,
      isMe: u.id === meId,
    }));
  }

  async create(email: string, fullName: string, meId: string) {
    const normalized = email.trim().toLowerCase();
    if (await this.prisma.salesUser.findUnique({ where: { email: normalized }, select: { id: true } })) {
      throw new BadRequestException('Bu e-posta ile kayıtlı bir satış kullanıcısı var');
    }
    const tempPassword = generateTempPassword();
    const u = await this.prisma.salesUser.create({
      data: { email: normalized, fullName: fullName.trim(), passwordHash: await hashPassword(tempPassword), createdById: meId },
      select: { id: true, email: true },
    });
    await this.audit.log({ salesUserId: meId, action: 'sales.user.create', target: u.id });
    return { ...u, tempPassword };
  }

  private async find(id: string) {
    const u = await this.prisma.salesUser.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!u) throw new NotFoundException('Kullanıcı bulunamadı');
    return u;
  }

  async update(id: string, dto: { isActive?: boolean; fullName?: string }, meId: string) {
    const target = await this.find(id);
    if (dto.isActive === false) {
      if (id === meId) throw new BadRequestException('Kendinizi devre dışı bırakamazsınız');
      const active = await this.prisma.salesUser.count({ where: { isActive: true } });
      if (target.isActive && active <= 1) throw new BadRequestException('En az bir aktif satış kullanıcısı kalmalı');
    }
    await this.prisma.salesUser.update({
      where: { id },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
        // Kapatılan kullanıcının açık oturumu hemen düşer
        ...(dto.isActive === false ? { sessionVersion: { increment: 1 } } : {}),
        ...(dto.isActive === true ? { failedLogins: 0, lockedUntil: null } : {}),
      },
    });
    await this.audit.log({ salesUserId: meId, action: 'sales.user.update', target: id, detail: { fields: Object.keys(dto), isActive: dto.isActive ?? null } });
    return { ok: true };
  }

  async resetPassword(id: string, meId: string) {
    await this.find(id);
    if (id === meId) throw new BadRequestException('Kendi şifrenizi "Şifre değiştir" ekranından değiştirin');
    const tempPassword = generateTempPassword();
    await this.prisma.salesUser.update({
      where: { id },
      data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null },
    });
    await this.audit.log({ salesUserId: meId, action: 'sales.user.password-reset', target: id });
    return { tempPassword };
  }

  async resetTwoFactor(id: string, meId: string) {
    await this.find(id);
    if (id === meId) throw new BadRequestException('Kendi doğrulamanızı başka bir ekip arkadaşınız sıfırlamalı');
    await this.prisma.salesUser.update({
      where: { id },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [], sessionVersion: { increment: 1 } },
    });
    await this.audit.log({ salesUserId: meId, action: 'sales.user.2fa-reset', target: id });
    return { ok: true };
  }
}
