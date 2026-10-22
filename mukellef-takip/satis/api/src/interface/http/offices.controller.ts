import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { OfficesService } from '../../application/offices.service.js';
import { MAX_TRIAL_DAYS, type OfficeStatus } from '../../domain/office.js';
import { CurrentSalesUser, type SalesUserCtx } from './session.js';

const STATUSES: OfficeStatus[] = ['aktif', 'deneme', 'suresi-doldu', 'donduruldu'];

class ListQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(STATUSES) status?: OfficeStatus;
}

class CreateOfficeDto {
  @IsString() @MinLength(2) @MaxLength(150) officeName: string;
  @IsString() @MinLength(2) @MaxLength(100) contactName: string;
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @MaxLength(30) phone: string;
  @IsOptional() @IsString() @MaxLength(30) plan?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_TRIAL_DAYS) trialDays?: number;
}

class UpdateOfficeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) officeName?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) contactName?: string;
  @IsOptional() @IsEmail() @MaxLength(200) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string;
}

class ExtendDto {
  @IsOptional() @IsIn([1, 6, 12]) months?: number;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_TRIAL_DAYS) days?: number;
  @IsOptional() @IsString() @MaxLength(30) plan?: string;
}

class SuspendDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

/** Büro (müşavir hesabı) yönetimi. Yanıtlarda mükellef verisi yoktur; yalnız hesap, lisans ve kullanıcı bilgisi. */
@Controller('offices')
export class OfficesController {
  constructor(private readonly offices: OfficesService) {}

  @Get('plans')
  plans() {
    return this.offices.plans();
  }

  @Get()
  list(@Query() q: ListQuery) {
    return this.offices.list(q.q, q.status);
  }

  @Post()
  create(@CurrentSalesUser() me: SalesUserCtx, @Body() dto: CreateOfficeDto) {
    return this.offices.create(dto, me.id);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.offices.detail(id);
  }

  @Patch(':id')
  update(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string, @Body() dto: UpdateOfficeDto) {
    return this.offices.update(id, dto, me.id);
  }

  @Post(':id/extend')
  @HttpCode(200)
  extend(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string, @Body() dto: ExtendDto) {
    return this.offices.extend(id, dto, me.id);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string, @Body() dto: SuspendDto) {
    return this.offices.suspend(id, dto.reason, me.id);
  }

  @Post(':id/resume')
  @HttpCode(200)
  resume(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string) {
    return this.offices.resume(id, me.id);
  }

  @Post(':id/users/:userId/reset-password')
  @HttpCode(200)
  resetPassword(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string, @Param('userId') userId: string) {
    return this.offices.resetPassword(id, userId, me.id);
  }

  @Post(':id/users/:userId/reset-2fa')
  @HttpCode(200)
  resetTwoFactor(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string, @Param('userId') userId: string) {
    return this.offices.resetTwoFactor(id, userId, me.id);
  }
}
