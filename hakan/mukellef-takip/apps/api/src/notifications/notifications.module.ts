import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeclarationsModule } from '../declarations/declarations.module.js';
import { EDefterModule } from '../edefter/edefter.module.js';
import { NOTIFY_QUEUE, NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { RemindersService } from './reminders.service.js';
import { WhatsappChannel } from './whatsapp.channel.js';

// Global: SGK, tebligat gibi modüller bildirim üretmek için NotificationsService'i doğrudan kullanır.
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: NOTIFY_QUEUE }), DeclarationsModule, EDefterModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, RemindersService, NotificationsProcessor, WhatsappChannel],
  exports: [NotificationsService],
})
export class NotificationsModule {}
