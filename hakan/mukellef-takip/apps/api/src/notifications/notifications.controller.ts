import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationCategory } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../audit.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { NotificationsService } from './notifications.service.js';
import { RemindersService } from './reminders.service.js';
import { WhatsappChannel, WhatsappError, normalizePhone } from './whatsapp.channel.js';

class SettingsDto {
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() whatsappEnabled?: boolean;
  /** WhatsApp'ı açarken zorunlu: kullanıcının bildirim almayı kabul ettiği onay kutusu. */
  @IsOptional() @IsBoolean() consent?: boolean;
  @IsOptional() @IsArray() @ArrayUnique() @IsEnum(NotificationCategory, { each: true }) categories?: NotificationCategory[];
}

@Controller()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly reminders: RemindersService,
    private readonly whatsapp: WhatsappChannel,
  ) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.list(user.tenantId, user.sub, { unreadOnly: unread === '1' });
  }

  @Post('notifications/:id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notifications.markRead(user.tenantId, user.sub, id);
    return { ok: true };
  }

  @Post('notifications/read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.tenantId, user.sub);
  }

  /** Üst bardaki kanal göstergesi için. */
  @Get('notifications/channels')
  async channels(@CurrentUser() user: AuthUser) {
    const optedIn = await this.prisma.user.count({
      where: { tenantId: user.tenantId, whatsappEnabled: true, whatsappOptInAt: { not: null }, phone: { not: null } },
    });
    return { whatsapp: { mode: this.whatsapp.mode, configured: this.whatsapp.configured, optedInUsers: optedIn } };
  }

  /** Hatırlatıcıları şimdi çalıştırır (sadece yönetici; normalde her sabah 08:30'da kendiliğinden çalışır). */
  @Post('notifications/reminders/run')
  async runReminders(@CurrentUser() user: AuthUser) {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    return { created: await this.reminders.runForTenant(user.tenantId) };
  }

  @Get('me/notification-settings')
  async settings(@CurrentUser() user: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      select: { phone: true, whatsappEnabled: true, whatsappOptInAt: true, notifyCategories: true },
    });
    return { ...u, channel: { mode: this.whatsapp.mode, configured: this.whatsapp.configured } };
  }

  @Put('me/notification-settings')
  async update(@CurrentUser() user: AuthUser, @Body() dto: SettingsDto) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      select: { phone: true, whatsappEnabled: true, whatsappOptInAt: true },
    });

    let phone = current.phone;
    if (dto.phone !== undefined) {
      phone = dto.phone.trim() ? normalizePhone(dto.phone) : null;
      if (dto.phone.trim() && !phone) throw new BadRequestException('Geçerli bir Türkiye cep telefonu girin (5xx xxx xx xx)');
    }

    // Kural: rıza numaraya bağlıdır. Numara değişirse eski rıza düşer ve WhatsApp kapanır;
    // WhatsApp ancak geçerli bir rızayla (yoksa bu istekte consent=true ile) açılabilir.
    const phoneChanged = phone !== current.phone;
    let optInAt = phoneChanged ? null : current.whatsappOptInAt;
    const enabled = dto.whatsappEnabled ?? (phoneChanged ? false : current.whatsappEnabled);
    if (enabled) {
      if (!phone) throw new BadRequestException('WhatsApp için önce telefon numarası girin');
      if (!optInAt) {
        if (!dto.consent) throw new BadRequestException('WhatsApp bildirimleri için onay vermelisiniz');
        optInAt = new Date();
      }
    }

    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        phone,
        whatsappEnabled: enabled,
        whatsappOptInAt: optInAt,
        ...(dto.categories ? { notifyCategories: dto.categories } : {}),
      },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'notifications.settings.update',
      detail: { whatsappEnabled: enabled, phoneChanged, newOptIn: !!optInAt && optInAt !== current.whatsappOptInAt },
    });
    return this.settings(user);
  }

  /** Kullanıcının kendi numarasına deneme mesajı. */
  @Post('me/notification-settings/test')
  async test(@CurrentUser() user: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.sub },
      select: { phone: true, whatsappEnabled: true, whatsappOptInAt: true },
    });
    if (!u.phone || !u.whatsappEnabled || !u.whatsappOptInAt) throw new BadRequestException('Önce WhatsApp bildirimlerini açın');
    try {
      const r = await this.whatsapp.send(u.phone, 'Deneme mesajı', 'WhatsApp bildirimleri çalışıyor.');
      return { ok: true, mode: this.whatsapp.mode, providerMessageId: r.providerMessageId };
    } catch (e) {
      if (e instanceof WhatsappError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
