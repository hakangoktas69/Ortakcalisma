import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { SalesAuthService } from '../../application/auth.service.js';
import { AllowTempPassword, clearSessionCookie, CurrentSalesUser, Public, type SalesUserCtx, setSessionCookie } from './session.js';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(200) password: string;
}

class StepDto {
  @IsString() @MaxLength(2000) token: string;
}

class SecondFactorDto extends StepDto {
  @IsOptional() @Matches(/^\d{6}$/, { message: 'Kod 6 haneli olmalı' }) code?: string;
  @IsOptional() @IsString() @MaxLength(20) recoveryCode?: string;
}

class EnableDto extends StepDto {
  @Matches(/^\d{6}$/, { message: 'Kod 6 haneli olmalı' }) code: string;
}

class PasswordDto {
  @IsString() @MaxLength(200) current: string;
  @IsString() @MaxLength(200) next: string;
}

/** Giriş akışı: şifre → (2FA kurulu) kod | (ilk giriş) kurulum → çerezde oturum. 2FA'sız oturum yoktur. */
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: SalesAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('login/2fa')
  @HttpCode(200)
  async secondFactor(@Body() dto: SecondFactorDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.secondFactor(dto.token, dto.code, dto.recoveryCode);
    setSessionCookie(res, r.accessToken);
    return { mustChangePassword: r.mustChangePassword };
  }

  @Public()
  @Post('2fa/setup')
  @HttpCode(200)
  setup(@Body() dto: StepDto) {
    return this.auth.setup(dto.token);
  }

  @Public()
  @Post('2fa/enable')
  @HttpCode(200)
  async enable(@Body() dto: EnableDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.auth.enable(dto.token, dto.code);
    setSessionCookie(res, r.accessToken);
    return { mustChangePassword: r.mustChangePassword, recoveryCodes: r.recoveryCodes };
  }

  @AllowTempPassword()
  @Get('me')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  me(@CurrentSalesUser() me: SalesUserCtx) {
    return me;
  }

  @AllowTempPassword()
  @Post('password')
  @HttpCode(200)
  async password(@CurrentSalesUser() me: SalesUserCtx, @Body() dto: PasswordDto, @Res({ passthrough: true }) res: Response) {
    setSessionCookie(res, await this.auth.changePassword(me.id, dto.current, dto.next));
    return { ok: true };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
    return { ok: true };
  }
}
