import { BadRequestException, Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { EDefterPreference } from '../../../../generated/prisma/enums.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../../../identity/index.js';
import { parseControlMonth } from '../../domain/declaration-rules.js';
import { EDefterService, defaultBeratMonth } from '../../application/edefter.service.js';

class BeratDto {
  /** null gönderilirse "yüklendi" işareti kaldırılır */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601() uploadedAt?: string | null;
  /** GİB süre uzatımı ya da Ekim–Aralık için elle son gün; null → kural tarihine dön */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601() dueDateOverride?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(300) note?: string | null;
}

class SettingsDto {
  @IsBoolean() enabled: boolean;
  @IsEnum(EDefterPreference) preference: EDefterPreference;
}

const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

@Controller('edefter')
@UseGuards(AuthGuard)
export class EDefterController {
  constructor(private readonly edefter: EDefterService) {}

  /** ?month=2026-06 (varsayılan: son günü bu aya denk gelen dönem) */
  @Get('control')
  control(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    const { year, month: m } = month ? parseControlMonth(month) : defaultBeratMonth();
    return this.edefter.control(user.tenantId, year, m);
  }

  @Get('companies')
  companies(@CurrentUser() user: AuthUser) {
    return this.edefter.companies(user.tenantId);
  }

  @Put('companies/:id')
  settings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SettingsDto) {
    return this.edefter.settings(user.tenantId, id, dto.enabled, dto.preference);
  }

  @Put('companies/:id/berats/:period')
  async berat(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('period') period: string,
    @Body() dto: BeratDto,
  ) {
    if (!/^\d{4}-(\d{2}|Q[1-4])$/.test(period)) throw new BadRequestException('Dönem 2026-06 veya 2026-Q2 biçiminde olmalı');
    await this.edefter.update(user.tenantId, user.sub, id, period, {
      uploadedAt: toDate(dto.uploadedAt),
      dueDateOverride: toDate(dto.dueDateOverride),
      note: dto.note,
    });
    return { ok: true };
  }
}

