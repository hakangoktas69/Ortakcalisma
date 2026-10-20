import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../../../../platform/security/security.module.js';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../../../../platform/database/prisma.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { AuthService } from '../../application/auth.service.js';
import { SessionService } from '../../application/session.service.js';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}

class SecondFactorDto {
  @IsString() mfaToken: string;
  @IsOptional() @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'Kod 6 haneli olmalı' }) code?: string;
  @IsOptional() @IsString() @MaxLength(20) recoveryCode?: string;
}

class ChangePasswordDto {
  @IsString() @MaxLength(200) currentPassword: string;
  @IsString() @MaxLength(200) newPassword: string;
}

class RefreshDto {
  @IsString() @MaxLength(200) refreshToken: string;
}

class CodeDto {
  @Matches(/^\s*\d{3}\s?\d{3}\s*$/, { message: 'Kod 6 haneli olmalı' }) code: string;
}

class DisableDto extends CodeDto {
  @IsString() @MaxLength(200) password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  /** 2FA kapalıysa { accessToken }, açıksa { mfaRequired: true, mfaToken } döner. */
  @Post('login')
  @Throttle(RATE_LIMITS.auth)
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.login(dto.email, dto.password, { userAgent });
  }

  @Post('login/2fa')
  @Throttle(RATE_LIMITS.auth)
  secondFactor(@Body() dto: SecondFactorDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.loginSecondFactor(dto.mfaToken, dto.code, dto.recoveryCode, { userAgent });
  }

  /** Yenileme anahtarı tek kullanımlıktır: yanıt yeni erişim + yenileme anahtarı içerir. */
  @Post('refresh')
  @Throttle(RATE_LIMITS.auth)
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.refresh(dto.refreshToken, { userAgent });
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: AuthUser) {
    if (user.fid) await this.sessions.logout(user.fid);
  }

  /** Açık cihaz oturumları */
  @Get('sessions')
  @UseGuards(AuthGuard)
  listSessions(@CurrentUser() user: AuthUser) {
    return this.sessions.list(user.sub, user.fid);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sessions.revokeForUser(user.tenantId, user.sub, id);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() auth: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        mustChangePassword: true,
        totpEnabledAt: true,
        recoveryCodeHashes: true,
        tenant: { select: { name: true, require2fa: true } },
      },
    });
    const { totpEnabledAt, recoveryCodeHashes, tenant, ...rest } = u;
    return {
      ...rest,
      tenant: { name: tenant.name },
      twoFactorEnabled: !!totpEnabledAt,
      twoFactorRequired: tenant.require2fa,
      recoveryCodesLeft: recoveryCodeHashes.length,
    };
  }

  @Post('password')
  @UseGuards(AuthGuard)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto.currentPassword, dto.newPassword);
  }

  @Post('2fa/setup')
  @UseGuards(AuthGuard)
  setup(@CurrentUser() user: AuthUser) {
    return this.auth.setupTotp(user);
  }

  @Post('2fa/enable')
  @UseGuards(AuthGuard)
  enable(@CurrentUser() user: AuthUser, @Body() dto: CodeDto) {
    return this.auth.enableTotp(user, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard)
  disable(@CurrentUser() user: AuthUser, @Body() dto: DisableDto) {
    return this.auth.disableTotp(user, dto.password, dto.code);
  }
}
