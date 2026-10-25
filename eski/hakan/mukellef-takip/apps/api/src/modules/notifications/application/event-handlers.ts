import { Injectable } from '@nestjs/common';
import { OnDomainEvent, type DomainEvent } from '../../../platform/events/outbox.service.js';
import { TEBLIGAT_IMPORTED, type TebligatImported } from '../../tebligat/index.js';
import { SGK_REPORTS_RECEIVED, type SgkReportsReceived } from '../../social-security/index.js';
import { LICENSE_EXTENDED, type LicenseExtended } from '../../billing/index.js';
import { NotificationsService } from './notifications.service.js';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR');

/**
 * Diğer context'lerin olaylarını bildirime çevirir (worker, olayın büro bağlamında).
 * `body` uygulama içinde görünür; `externalBody` dış kanala (WhatsApp, yurt dışı) gider ve mükellef / çalışan
 * adı gibi kişisel veri içermez. dedupeKey olay başına tek bildirim sağlar (olaylar en az bir kez teslim edilir).
 */
@Injectable()
export class NotificationEventHandlers {
  constructor(private readonly notifications: NotificationsService) {}

  @OnDomainEvent(TEBLIGAT_IMPORTED)
  async tebligatImported(e: DomainEvent) {
    const p = e.payload as unknown as TebligatImported;
    await this.notifications.notify(e.tenantId, {
      category: 'TEBLIGAT',
      title: p.count === 1 ? `Yeni e-tebligat: ${p.companyTitle}` : `${p.count} yeni e-tebligat: ${p.companyTitle}`,
      body:
        p.count === 1
          ? `${p.first.subject ?? 'Tebligat'}${p.first.sender ? ` (${p.first.sender})` : ''} — ${fmt(p.first.deemedServedAt)} günü sonunda tebliğ edilmiş sayılır.`
          : `En yakın tebliğ sayılma tarihi ${fmt(p.first.deemedServedAt)}.`,
      externalBody: `${p.count} yeni e-tebligat; en yakın tebliğ sayılma tarihi ${fmt(p.first.deemedServedAt)}.`,
      link: '/tebligat',
      dedupeKey: eventKey(e),
    });
  }

  @OnDomainEvent(SGK_REPORTS_RECEIVED)
  async sgkReportsReceived(e: DomainEvent) {
    const p = e.payload as unknown as SgkReportsReceived;
    await this.notifications.notify(e.tenantId, {
      category: 'SGK_RAPOR',
      title: `${p.count} yeni e-Rapor onay bekliyor: ${p.companyTitle}`,
      body: `${p.names.join(', ')}${p.count > p.names.length ? ' …' : ''} — çalışmazlık bildirimi bekleniyor.`,
      // Sağlık verisi + ad özel nitelikli kişisel veridir: dış kanala yalnız sayı gider
      externalBody: `${p.count} yeni e-rapor çalışmazlık bildirimi bekliyor.`,
      link: '/sgk',
      dedupeKey: eventKey(e),
    });
  }

  @OnDomainEvent(LICENSE_EXTENDED)
  async licenseExtended(e: DomainEvent) {
    const p = e.payload as unknown as LicenseExtended;
    const body = `${p.planName} paketi, ${fmt(p.expiresAt)} tarihine kadar geçerli.`;
    await this.notifications.notify(e.tenantId, {
      category: 'SISTEM',
      title: 'Lisans uzatıldı',
      body,
      externalBody: body,
      link: '/odeme',
      dedupeKey: eventKey(e),
    });
  }
}

/** Aynı olay yeniden teslim edilirse ikinci bildirim oluşmasın: outbox olay kimliği. */
function eventKey(e: DomainEvent) {
  return `event:${e.id ?? `${e.type}:${Date.now()}`}`;
}
