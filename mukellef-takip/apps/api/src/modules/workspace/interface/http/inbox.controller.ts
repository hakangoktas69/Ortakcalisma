import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { AuthGuard, CurrentUser, type AuthUser } from '../../../identity/index.js';
import { InboxService } from '../../application/inbox.service.js';

const KEY = /^(decl|teb|rapor|berat|bordro|bordro-eksik|lisans):[\w:.-]{1,200}$/;

class SnoozeDto {
  @Matches(KEY, { message: 'Geçersiz iş anahtarı' }) @MaxLength(220) key: string;
  /** 1 = yarına, 7 = gelecek haftaya */
  @IsIn([1, 3, 7]) days: number;
}

class UnsnoozeDto {
  @IsString() @Matches(KEY, { message: 'Geçersiz iş anahtarı' }) key: string;
}

@Controller('inbox')
@UseGuards(AuthGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.inbox.list(user.tenantId);
  }

  /** Büro genelinde erteler: iş, seçilen günün sabahına kadar listede "ertelendi" olarak gizlenir. */
  @Post('snooze')
  snooze(@CurrentUser() user: AuthUser, @Body() dto: SnoozeDto) {
    const until = new Date();
    until.setHours(8, 0, 0, 0);
    until.setDate(until.getDate() + dto.days);
    return this.inbox.snooze(user.tenantId, user.sub, dto.key, until);
  }

  @Post('unsnooze')
  unsnooze(@CurrentUser() user: AuthUser, @Body() dto: UnsnoozeDto) {
    return this.inbox.unsnooze(user.tenantId, dto.key);
  }
}
