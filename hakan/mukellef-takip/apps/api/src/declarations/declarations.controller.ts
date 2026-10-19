import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ArrayUnique, IsArray, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { DeclarationType } from '../generated/prisma/enums.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { DeclarationsService } from './declarations.service.js';
import { parseControlMonth } from './declaration-rules.js';
import { GibSourceError } from './gib/gib-source.js';

class MarkFiledDto {
  @IsString() companyId: string;
  @IsEnum(DeclarationType) type: DeclarationType;
  @Matches(/^\d{4}(-\d{2}|-Q[1-3])?$/, { message: 'Dönem 2026-09, 2026-Q3 veya 2026 biçiminde olmalı' }) period: string;
  @IsOptional() @IsISO8601() filedAt?: string;
  @IsOptional() @IsNumber() @Min(0) accrualAmount?: number;
  @IsOptional() @IsString() note?: string;
}

class ObligationsDto {
  @IsArray() @ArrayUnique() @IsEnum(DeclarationType, { each: true }) active: DeclarationType[];
}

@Controller()
export class DeclarationsController {
  constructor(private readonly declarations: DeclarationsService) {}

  /** ?month=2026-09 (varsayılan: bir önceki ay) */
  @Get('declarations/control')
  @UseGuards(AuthGuard)
  control(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    const { year, month: m } = parseControlMonth(month);
    return this.declarations.control(user.tenantId, year, m);
  }

  @Post('declarations/sync')
  @UseGuards(AuthGuard)
  async sync(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    const { year, month: m } = parseControlMonth(month);
    try {
      return await this.declarations.syncFromGib(user.tenantId, year, m);
    } catch (e) {
      if (e instanceof GibSourceError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Post('declarations')
  @UseGuards(AuthGuard)
  mark(@CurrentUser() user: AuthUser, @Body() dto: MarkFiledDto) {
    return this.declarations.markFiled(user.tenantId, user.sub, {
      ...dto,
      filedAt: dto.filedAt ? new Date(dto.filedAt) : undefined,
    });
  }

  @Delete('declarations/:id')
  @UseGuards(AuthGuard)
  async unmark(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.declarations.unmark(user.tenantId, id);
    return { ok: true };
  }

  @Get('companies/:id/obligations')
  @UseGuards(AuthGuard)
  obligations(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.declarations.obligations(user.tenantId, id);
  }

  @Put('companies/:id/obligations')
  @UseGuards(AuthGuard)
  setObligations(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ObligationsDto) {
    return this.declarations.setObligations(user.tenantId, id, dto.active);
  }
}
