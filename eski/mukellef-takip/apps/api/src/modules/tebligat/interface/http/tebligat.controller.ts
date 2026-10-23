import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { AuthGuard, CurrentUser, type AuthUser } from '../../../identity/index.js';
import { TebligatService } from '../../application/tebligat.service.js';

class ReviewDto {
  @IsBoolean() reviewed: boolean;
}

@Controller('tebligat')
@UseGuards(AuthGuard)
export class TebligatController {
  constructor(private readonly tebligat: TebligatService) {}

  /** ?status=open|all&days=90&q= */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: 'open' | 'all',
    @Query('days') days?: string,
    @Query('q') q?: string,
  ) {
    return this.tebligat.list(user.tenantId, { status, days: Number(days) || undefined, q: q?.trim() || undefined });
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.tebligat.summary(user.tenantId);
  }

  /** Büro içinde "incelendi" işareti. GİB'deki okunma durumunu değiştirmez. */
  @Put(':id/review')
  async review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewDto) {
    await this.tebligat.setReviewed(user.tenantId, user.sub, id, dto.reviewed);
    return { ok: true };
  }
}
