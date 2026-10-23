import { Body, Controller, Delete, Get, Logger, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AdminGuard, AuthGuard, CurrentUser, type AuthUser } from '../../../identity/index.js';
import { RATE_LIMITS } from '../../../../platform/security/security.module.js';
import { AssistantService, type AssistantEvent } from '../../application/assistant.service.js';

class AskDto {
  @IsOptional() @IsString() conversationId?: string;
  @IsString() @MinLength(2, { message: 'Soru çok kısa' }) @MaxLength(4000, { message: 'Soru en fazla 4000 karakter olabilir' }) message: string;
}

class ConsentDto {
  @IsBoolean() accept: boolean;
}

@Controller('assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(private readonly assistant: AssistantService) {}

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.assistant.status(user.tenantId);
  }

  /** Yönetici: yurt dışı aktarım onayı (KVKK md.9). Geri alınabilir. */
  @Put('consent')
  @UseGuards(AdminGuard)
  consent(@CurrentUser() user: AuthUser, @Body() dto: ConsentDto) {
    return this.assistant.setConsent(user.tenantId, user.sub, dto.accept);
  }

  @Get('conversations')
  conversations(@CurrentUser() user: AuthUser) {
    return this.assistant.conversations(user.sub);
  }

  @Get('conversations/:id')
  conversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assistant.conversation(id, user.sub);
  }

  @Delete('conversations/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assistant.remove(id, user.sub);
  }

  /** Yanıtı Server-Sent Events olarak akıtır: meta → delta… → done | error */
  @Post('ask')
  @Throttle(RATE_LIMITS.heavy)
  async ask(@CurrentUser() user: AuthUser, @Body() dto: AskDto, @Res() res: Response) {
    // Kota / yetki hataları akış başlamadan normal HTTP hatası olarak döner
    const ctx = await this.assistant.prepare(user, dto);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });
    const emit = (e: AssistantEvent) => {
      if (!res.writableEnded) res.write(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);
    };
    try {
      await this.assistant.run(ctx, emit, abort.signal);
    } catch (e) {
      this.logger.error(e);
    } finally {
      res.end();
    }
  }
}
