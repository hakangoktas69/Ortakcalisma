import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { runAsSystem } from '../../../platform/database/tenant-context.js';
import { NOTIFY_QUEUE, NotificationsService } from '../application/notifications.service.js';
import { RemindersService } from '../application/reminders.service.js';

/**
 * Bildirim kuyruğu (yalnız worker süreci):
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
    // Gönderim kaydı büro bağımsız kimlikle bulunur (sistem bağlamı); hatırlatıcılar büro başına bağlam kurar
    if (job.name === 'deliver') return runAsSystem(() => this.notifications.deliver((job.data as { deliveryId: string }).deliveryId));
    if (job.name === 'daily-reminders') return this.reminders.runAll();
    throw new Error(`Bilinmeyen iş: ${job.name}`);
  }
}
