import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { ApiTokenService } from './api-token.service.js';
import { AuditService } from '../audit.service.js';

class CreateTokenDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
}

// Anahtar yönetimi sadece normal oturumla yapılır (eklenti anahtarıyla değil).
@Controller('tokens')
@UseGuards(AuthGuard)
export class TokensController {
  constructor(
    private readonly tokens: ApiTokenService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tokens.list(user.tenantId);
  }

  /** Şimdilik tek kapsam var: GİB sayfasından beyanname ve tebligat aktarma. */
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTokenDto) {
    const created = await this.tokens.create(user.tenantId, user.sub, dto.name, ['gib:import']);
    await this.audit.log({ tenantId: user.tenantId, userId: user.sub, action: 'token.create', target: created.id });
    return created;
  }

  @Delete(':id')
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.tokens.revoke(user.tenantId, id);
    await this.audit.log({ tenantId: user.tenantId, userId: user.sub, action: 'token.revoke', target: id });
    return { ok: true };
  }
}
