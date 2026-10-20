import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../../platform/database/prisma.service.js';
import { AuditService } from '../../../../platform/audit/audit.service.js';
import { AdminGuard, AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { generateTempPassword, hashPassword } from '../../application/auth.service.js';

class PolicyDto {
  @IsBoolean() require2fa: boolean;
}

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) @MaxLength(100) fullName: string;
  @IsEnum(UserRole) role: UserRole;
}

class UpdateUserDto {
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) fullName?: string;
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  totpEnabledAt: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
} as const;

/**
 * Büro kullanıcıları (sadece yönetici). Yeni kullanıcıya ve şifre sıfırlamada geçici şifre üretilir,
 * yanıtta BİR KEZ gösterilir; kullanıcı ilk girişte değiştirmek zorundadır.
 * Büroda en az bir aktif yönetici kalmak zorundadır.
 */
@Controller('users')
@UseGuards(AuthGuard, AdminGuard)
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async own(tenantId: string, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, tenantId }, select: { id: true, role: true, isActive: true, email: true } });
    if (!u) throw new NotFoundException('Kullanıcı bulunamadı');
    return u;
  }

  @Get()
  async list(@CurrentUser() me: AuthUser) {
    const users = await this.prisma.user.findMany({ where: { tenantId: me.tenantId }, select: userSelect, orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }] });
    return users.map(({ totpEnabledAt, lockedUntil, ...u }) => ({
      ...u,
      twoFactorEnabled: !!totpEnabledAt,
      locked: !!lockedUntil && lockedUntil > new Date(),
      isMe: u.id === me.sub,
    }));
  }

  /** Büro güvenlik politikası ve 2FA kurmamış aktif kullanıcı sayısı */
  @Get('policy')
  async policy(@CurrentUser() me: AuthUser) {
    const [tenant, without] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: me.tenantId }, select: { require2fa: true } }),
      this.prisma.user.count({ where: { tenantId: me.tenantId, isActive: true, totpEnabledAt: null } }),
    ]);
    return { require2fa: tenant.require2fa, usersWithout2fa: without };
  }

  /**
   * 2FA zorunluluğunu açar / kapatır. Açmak için yöneticinin kendi hesabında 2FA açık olmalı
   * (yoksa kendini kurulum ekranına kilitler). Kurmamış kullanıcılar bir sonraki istekte kurulum ekranına yönlenir.
   */
  @Put('policy')
  async setPolicy(@CurrentUser() me: AuthUser, @Body() dto: PolicyDto) {
    if (dto.require2fa) {
      const self = await this.prisma.user.findUniqueOrThrow({ where: { id: me.sub }, select: { totpEnabledAt: true } });
      if (!self.totpEnabledAt) throw new BadRequestException('Zorunlu yapmadan önce kendi hesabınızda iki adımlı doğrulamayı açın (Ayarlar)');
    }
    await this.prisma.tenant.update({ where: { id: me.tenantId }, data: { require2fa: dto.require2fa } });
    await this.audit.log({ tenantId: me.tenantId, userId: me.sub, action: dto.require2fa ? 'policy.2fa.require' : 'policy.2fa.optional' });
    return this.policy(me);
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new BadRequestException('Bu e-posta ile kayıtlı bir kullanıcı var');
    }
    const tempPassword = generateTempPassword();
    const u = await this.prisma.user.create({
      data: { tenantId: me.tenantId, email, fullName: dto.fullName.trim(), role: dto.role, passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
      select: { id: true, email: true },
    });
    await this.audit.log({ tenantId: me.tenantId, userId: me.sub, action: 'user.create', target: u.id, detail: { role: dto.role } });
    return { ...u, tempPassword };
  }

  @Patch(':id')
  async update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    const target = await this.own(me.tenantId, id);
    const losesAdmin = target.role === 'ADMIN' && target.isActive && (dto.role === 'STAFF' || dto.isActive === false);
    if (losesAdmin) {
      const admins = await this.prisma.user.count({ where: { tenantId: me.tenantId, role: 'ADMIN', isActive: true } });
      if (admins <= 1) throw new BadRequestException('Büroda en az bir aktif yönetici kalmalı');
    }
    if (id === me.sub && dto.isActive === false) throw new BadRequestException('Kendinizi devre dışı bırakamazsınız');

    await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        // Devre dışı bırakma veya rol değişikliği mevcut oturumları sonlandırır
        ...(dto.isActive === false || (dto.role && dto.role !== target.role) ? { sessionVersion: { increment: 1 } } : {}),
        ...(dto.isActive === true ? { failedLogins: 0, lockedUntil: null } : {}),
      },
    });
    await this.audit.log({ tenantId: me.tenantId, userId: me.sub, action: 'user.update', target: id, detail: { ...dto } });
    return { ok: true };
  }

  @Post(':id/reset-password')
  async resetPassword(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.own(me.tenantId, id);
    const tempPassword = generateTempPassword();
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null },
    });
    await this.audit.log({ tenantId: me.tenantId, userId: me.sub, action: 'user.password.reset', target: id });
    return { tempPassword };
  }

  /** Telefonu kaybeden kullanıcı için: 2FA'yı kapatır, kullanıcı yeniden kurar. */
  @Post(':id/reset-2fa')
  async reset2fa(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.own(me.tenantId, id);
    await this.prisma.user.update({
      where: { id },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [], sessionVersion: { increment: 1 } },
    });
    await this.audit.log({ tenantId: me.tenantId, userId: me.sub, action: 'user.2fa.reset', target: id });
    return { ok: true };
  }
}
