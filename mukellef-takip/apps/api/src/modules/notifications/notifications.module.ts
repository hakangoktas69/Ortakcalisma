import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TaxFilingModule } from '../tax-filing/index.js';
import { NOTIFY_QUEUE, NotificationsService } from './application/notifications.service.js';
import { NotificationsController } from './interface/http/notifications.controller.js';
import { NotificationsProcessor } from './infrastructure/notifications.processor.js';
import { RemindersService } from './application/reminders.service.js';
import { NotificationEventHandlers } from './application/event-handlers.js';
import { WhatsappChannel } from './infrastructure/whatsapp.channel.js';

// Diğer context'ler bildirimi doğrudan çağırmaz; olay yayınlar (NotificationEventHandlers abone olur).
@Module({
  imports: [BullModule.registerQueue({ name: NOTIFY_QUEUE }), TaxFilingModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, RemindersService, WhatsappChannel, NotificationEventHandlers],
  exports: [NotificationsService, RemindersService],
})
export class NotificationsModule {}

/** Yalnız worker süreci: WhatsApp gönderimi ve günlük hatırlatıcılar. */
@Module({
  imports: [NotificationsModule, BullModule.registerQueue({ name: NOTIFY_QUEUE })],
  providers: [NotificationsProcessor],
})
export class NotificationsWorkerModule {}
