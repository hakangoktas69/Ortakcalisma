import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type { NotificationCategory } from '../../../generated/prisma/enums.js';
import { WhatsappChannel } from '../infrastructure/whatsapp.channel.js';

export const NOTIFY_QUEUE = 'notifications';

/** Dış kanal mesaj başlığı: kategori adı (başlıkta firma adı olabileceğinden bildirim başlığı gönderilmez). */
export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  TEBLIGAT: 'e-Tebligat',
  SGK_RAPOR: 'SGK e-Rapor',
  BEYANNAME_SON_GUN: 'Beyanname son günü',
  BEYANNAME_GECIKTI: 'Geciken beyanname',
  EDEFTER: 'e-Defter',
  SISTEM: 'Sistem',
};
const EXTERNAL_FALLBACK = 'Ayrıntılar için portala giriş yapın.';

export interface NewNotification {
  category: NotificationCategory;
  title: string;
  body?: string;
  /** WhatsApp gibi dış kanala giden metin: mükellef/çalışan adı vb. kişisel veri İÇERMEZ. Boşsa genel metin gider. */
  externalBody?: string;
  link?: string;
  /** Verilirse aynı anahtarla ikinci bildirim oluşturulmaz. */
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappChannel,
    @InjectQueue(NOTIFY_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Bildirimi oluşturur ve WhatsApp'a rıza vermiş, bu kategoriyi seçmiş kullanıcılar için gönderim sıraya alır.
   * dedupeKey daha önce kullanıldıysa hiçbir şey yapmaz ve null döner.
   */
  async notify(tenantId: string, n: NewNotification) {
    if (n.dedupeKey) {
      const exists = await this.prisma.notification.findUnique({
        where: { tenantId_dedupeKey: { tenantId, dedupeKey: n.dedupeKey } },
        select: { id: true },
      });
      if (exists) return null;
    }
    const notification = await this.prisma.notification.create({ data: { tenantId, ...n } });

    if (this.whatsapp.mode !== 'off') {
      const recipients = await this.prisma.user.findMany({
        where: {
          tenantId,
          whatsappEnabled: true,
          whatsappOptInAt: { not: null },
          phone: { not: null },
          notifyCategories: { has: n.category },
        },
        select: { id: true },
      });
      for (const r of recipients) {
        const d = await this.prisma.notificationDelivery.create({
          data: { notificationId: notification.id, userId: r.id, channel: 'WHATSAPP' },
        });
        await this.queue.add(
          'deliver',
          { deliveryId: d.id },
          { attempts: 3, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: true, removeOnFail: 500 },
        );
      }
    }
    return notification;
  }

  async list(tenantId: string, userId: string, opts: { unreadOnly?: boolean; take?: number } = {}) {
    const rows = await this.prisma.notification.findMany({
      where: { tenantId, ...(opts.unreadOnly ? { reads: { none: { userId } } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: opts.take ?? 30,
      select: {
        id: true,
        category: true,
        title: true,
        body: true,
        link: true,
        createdAt: true,
        reads: { where: { userId }, select: { readAt: true } },
      },
    });
    const unread = await this.prisma.notification.count({ where: { tenantId, reads: { none: { userId } } } });
    return {
      unread,
      items: rows.map(({ reads, ...n }) => ({ ...n, isRead: reads.length > 0 })),
    };
  }

  async markRead(tenantId: string, userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!n) return;
    await this.prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId: id, userId } },
      create: { notificationId: id, userId },
      update: {},
    });
  }

  async markAllRead(tenantId: string, userId: string) {
    const unread = await this.prisma.notification.findMany({
      where: { tenantId, reads: { none: { userId } } },
      select: { id: true },
    });
    await this.prisma.notificationRead.createMany({
      data: unread.map((n) => ({ notificationId: n.id, userId })),
      skipDuplicates: true,
    });
    return { marked: unread.length };
  }

  /** Kuyruk işçisi çağırır: tek bir WhatsApp gönderimini yapar ve sonucu kaydeder. */
  async deliver(deliveryId: string) {
    const d = await this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        notification: { select: { category: true, externalBody: true } },
        user: { select: { phone: true, whatsappEnabled: true, whatsappOptInAt: true } },
      },
    });
    if (!d || d.status === 'SENT') return;
    // Sıradayken rıza geri çekildiyse gönderme
    if (!d.user.whatsappEnabled || !d.user.whatsappOptInAt || !d.user.phone) {
      await this.prisma.notificationDelivery.update({
        where: { id: d.id },
        data: { status: 'FAILED', error: 'Kullanıcı WhatsApp bildirimlerini kapattı' },
      });
      return;
    }
    try {
      // KVKK md.9: Meta (yurt dışı) üzerinden yalnız kategori ve kişisel veri içermeyen metin gider
      const r = await this.whatsapp.send(d.user.phone, CATEGORY_LABEL[d.notification.category], d.notification.externalBody ?? EXTERNAL_FALLBACK);
      await this.prisma.notificationDelivery.update({
        where: { id: d.id },
        data: { status: 'SENT', providerMessageId: r.providerMessageId, sentAt: new Date(), error: null },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.prisma.notificationDelivery.update({ where: { id: d.id }, data: { status: 'FAILED', error: message.slice(0, 500) } });
      throw e; // kuyruk yeniden denesin
    }
  }
}
