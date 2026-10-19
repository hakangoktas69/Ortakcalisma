import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { AuthService } from './auth.service.js';

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
  ) {}

  /** 2FA kapalıysa { accessToken }, açıksa { mfaRequired: true, mfaToken } döner. */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('login/2fa')
  secondFactor(@Body() dto: SecondFactorDto) {
    return this.auth.loginSecondFactor(dto.mfaToken, dto.code, dto.recoveryCode);
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
