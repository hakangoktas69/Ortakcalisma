import { Body, Controller, Get, HttpCode, Logger, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminGuard, AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { BillingService } from './billing.service.js';

class CheckoutDto {
  @IsString() plan: string;
  @IsIn([1, 6, 12]) months: number;
}

class ProfileDto {
  @IsString() @MinLength(2) @MaxLength(200) billingName: string;
  @IsString() @MinLength(3) @MaxLength(100) billingContactName: string;
  @IsString() @MaxLength(20) billingTaxNumber: string;
  @IsOptional() @IsString() @MaxLength(100) billingTaxOffice?: string;
  @IsString() @MinLength(5) @MaxLength(400) billingAddress: string;
  @IsString() @MinLength(2) @MaxLength(60) billingCity: string;
  @IsEmail() billingEmail: string;
  @IsString() @MaxLength(25) billingPhone: string;
}

/** Proxy arkasında da doğru istemci IP'si (iyzico alıcı bilgisi için; dolandırıcılık kontrolünde kullanılır). */
function clientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return (first || req.socket.remoteAddress || '').replace(/^::ffff:/, '') || undefined;
}

@Controller('billing')
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Lisans durumu, paketler ve ödeme geçmişi (tüm kullanıcılar görebilir). */
  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.billing.overview(user.tenantId);
  }

  @Get('profile')
  @UseGuards(AdminGuard)
  profile(@CurrentUser() user: AuthUser) {
    return this.billing.profile(user.tenantId);
  }

  @Put('profile')
  @UseGuards(AdminGuard)
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    return this.billing.updateProfile(user.tenantId, user.sub, dto);
  }

  /** Ödeme başlatma (sadece yönetici). iyzico'da yanıt redirectUrl içerir. */
  @Post('checkout')
  @UseGuards(AdminGuard)
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto, @Req() req: Request) {
    return this.billing.checkout(user.tenantId, user.sub, dto.plan, dto.months, clientIp(req));
  }

  @Post('payments/:id/demo-confirm')
  @UseGuards(AdminGuard)
  demoConfirm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.demoConfirm(user.tenantId, user.sub, id);
  }

  /** Bekleyen iyzico ödemesini yeniden sorgula (ör. incelemedeyken ya da geri dönüş yarıda kaldıysa). */
  @Post('payments/:id/refresh')
  @UseGuards(AdminGuard)
  refresh(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.refresh(user.tenantId, id);
  }

  @Post('payments/:id/cancel')
  @UseGuards(AdminGuard)
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.billing.cancel(user.tenantId, id);
    return { ok: true };
  }
}

/**
 * iyzico'nun ödeme sonrası kullanıcıyı geri gönderdiği adres (form POST, alan: token). Oturum gerektirmez:
 * hiçbir şeyi tarayıcının sözüne göre onaylamaz, token'la iyzico'ya sorar. Sonra kullanıcıyı portala yönlendirir.
 */
@Controller('billing/iyzico')
export class IyzicoCallbackController {
  private readonly logger = new Logger(IyzicoCallbackController.name);
  constructor(private readonly billing: BillingService) {}

  @Post('callback')
  @HttpCode(303)
  async callback(@Body() body: { token?: unknown }, @Res() res: Response) {
    const web = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/+$/, '');
    const token = typeof body?.token === 'string' && /^[\w-]{10,200}$/.test(body.token) ? body.token : null;
    let result = 'bilinmiyor';
    if (token) {
      try {
        const r = await this.billing.settleIyzico(token);
        result = { PAID: 'basarili', REVIEW: 'inceleniyor', FAILED: 'basarisiz', UNKNOWN: 'bilinmiyor' }[r.outcome];
      } catch (e) {
        // iyzico'ya ulaşılamadıysa ödeme beklemede kalır; kullanıcı ödeme sayfasından durumu yenileyebilir
        this.logger.error(`iyzico geri dönüşü işlenemedi: ${e instanceof Error ? e.message : e}`);
        result = 'kontrol';
      }
    }
    res.redirect(303, `${web}/odeme?odeme=${result}`);
  }
}
