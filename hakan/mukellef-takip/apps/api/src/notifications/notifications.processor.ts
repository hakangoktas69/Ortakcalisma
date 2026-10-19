import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { NOTIFY_QUEUE, NotificationsService } from './notifications.service.js';
import { RemindersService } from './reminders.service.js';

/**
 * Bildirim kuyruğu:
 * - "deliver": tek bir WhatsApp gönderimi (saniyede en fazla 10; Meta'nın hız sınırlarının çok altında)
 * - "daily-reminders": her sabah 08:30 (İstanbul) beyanname ve tebligat hatırlatıcıları
 */
@Processor(NOTIFY_QUEUE, { concurrency: 4, limiter: { max: 10, duration: 1000 } })
export class NotificationsProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly reminders: RemindersService,
    @InjectQueue(NOTIFY_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      'daily-reminders',
      { pattern: '30 8 * * *', tz: 'Europe/Istanbul' },
      { name: 'daily-reminders', data: {} },
    );
  }

  async process(job: Job) {
    if (job.name === 'deliver') return this.notifications.deliver((job.data as { deliveryId: string }).deliveryId);
    if (job.name === 'daily-reminders') return this.reminders.runAll();
    throw new Error(`Bilinmeyen iş: ${job.name}`);
  }
}
