import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { VaultService } from '../vault/vault.service.js';
import { AuditService } from '../audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  VIZITE_CLIENT,
  ViziteError,
  parseSgkDate,
  type ViziteClient,
  type ViziteCredentials,
  type ViziteReportRow,
} from './vizite/vizite.types.js';
import type { ReportStatus } from '../generated/prisma/enums.js';

const MAX_PAGES = 20; // Tek senkronda en fazla 20 × 100 rapor
const APPROVED_LOOKBACK_DAYS = 60;

@Injectable()
export class ViziteSyncService {
  private readonly logger = new Logger(ViziteSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(VIZITE_CLIENT) private readonly client: ViziteClient,
  ) {}

  get mode() {
    return this.client.mode;
  }

  /** İşyeri şifresini çözer ve her çözmeyi denetim kaydına yazar. */
  private async credentialsFor(workplaceId: string, userId: string | null) {
    const wp = await this.prisma.sgkWorkplace.findUnique({
      where: { id: workplaceId },
      include: { company: { select: { tenantId: true, title: true } } },
    });
    if (!wp) throw new NotFoundException('İşyeri bulunamadı');
    if (!wp.viziteUsername || !wp.viziteWorkplaceCode || !wp.viziteSecretEnc) {
      throw new ViziteError('wsLogin', 103, 'Vizite giriş bilgileri girilmemiş');
    }
    await this.audit.log({
      tenantId: wp.company.tenantId,
      userId,
      action: 'vizite.credentials.decrypt',
      target: wp.id,
    });
    const creds: ViziteCredentials = {
      kullaniciAdi: wp.viziteUsername,
      isyeriKodu: wp.viziteWorkplaceCode,
      isyeriSifresi: this.vault.decrypt(wp.viziteSecretEnc),
    };
    return { wp, creds };
  }

  /** Bilgileri kaydetmeden önce SGK'ya giriş denemesi yapar. */
  async testLogin(creds: ViziteCredentials) {
    await this.client.login(creds);
  }

  async syncWorkplace(workplaceId: string, userId: string | null = null) {
    await this.prisma.sgkWorkplace.update({ where: { id: workplaceId }, data: { lastSyncStatus: 'RUNNING' } });
    try {
      const { wp, creds } = await this.credentialsFor(workplaceId, userId);
      const token = await this.client.login(creds);

      // 1) Bekleyen raporlar: oku → kaydet → SGK'da "okundu" olarak kapat.
      // Kapatma, kayıt başarılı olduktan SONRA yapılır; kayıt düşerse rapor bir sonraki senkronda tekrar gelir.
      const tomorrow = new Date(Date.now() + 86_400_000);
      let pending = 0;
      const newPending: string[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const rows = await this.client.pendingReports(creds, token, tomorrow);
        for (const row of rows) {
          const known = await this.prisma.sgkReport.findUnique({
            where: { workplaceId_medulaRaporId: { workplaceId, medulaRaporId: row.MEDULARAPORID } },
            select: { id: true },
          });
          await this.upsert(workplaceId, row, 'PENDING');
          if (!known) newPending.push([row.AD, row.SOYAD].filter(Boolean).join(' ') || row.TCKIMLIKNO.slice(-4));
          await this.client.markRead(creds, token, row.MEDULARAPORID);
        }
        pending += rows.length;
        if (rows.length < 100) break;
      }

      // 2) Onaylı raporlar: son 60 gün
      const from = new Date(Date.now() - APPROVED_LOOKBACK_DAYS * 86_400_000);
      const approved = await this.client.approvedReports(creds, token, from, new Date());
      for (const row of approved) await this.upsert(workplaceId, row, 'APPROVED');

      await this.prisma.sgkWorkplace.update({
        where: { id: workplaceId },
        data: { lastSyncStatus: 'OK', lastSyncAt: new Date(), lastSyncError: null },
      });

      if (newPending.length) {
        await this.notifications.notify(wp.company.tenantId, {
          category: 'SGK_RAPOR',
          title: `${newPending.length} yeni e-Rapor onay bekliyor: ${wp.company.title}`,
          body: `${newPending.slice(0, 3).join(', ')}${newPending.length > 3 ? ' …' : ''} — çalışmazlık bildirimi bekleniyor.`,
          link: '/sgk',
        });
      }
      return { pending, newPending: newPending.length, approved: approved.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`İşyeri ${workplaceId} senkron hatası: ${message}`);
      await this.prisma.sgkWorkplace.update({
        where: { id: workplaceId },
        data: { lastSyncStatus: 'ERROR', lastSyncAt: new Date(), lastSyncError: message.slice(0, 500) },
      });
      throw e;
    }
  }

  private upsert(workplaceId: string, row: ViziteReportRow, status: ReportStatus) {
    const fullName = [row.AD, row.SOYAD].filter(Boolean).join(' ') || '—';
    const data = {
      tckn: row.TCKIMLIKNO,
      fullName,
      vaka: Number(row.VAKA) || 0,
      vakaAdi: row.VAKAADI ?? null,
      policlinicDate: parseSgkDate(row.POLIKLINIKTAR),
      startDate: parseSgkDate(row.ABASTAR) ?? parseSgkDate(row.YATRAPBASTAR),
      endDate: parseSgkDate(row.ABITTAR) ?? parseSgkDate(row.YATRAPBITTAR),
      workControlDate: parseSgkDate(row.ISBASKONTTAR),
      sgkStatusCode: row.RAPORDURUMU ?? null,
      facilityName: row.TESISADI ?? null,
      raw: { ...row },
    };
    return this.prisma.sgkReport.upsert({
      where: { workplaceId_medulaRaporId: { workplaceId, medulaRaporId: row.MEDULARAPORID } },
      create: { workplaceId, medulaRaporId: row.MEDULARAPORID, status, ...data },
      // Onaylı bir rapor bekleyen listesinde tekrar görünse bile onay durumu geri alınmaz
      update: status === 'APPROVED' ? { ...data, status, approvedAt: new Date() } : data,
    });
  }

  /** Çalışmazlık bildirimi: SGK'ya YAZAN işlem, sadece kullanıcı isteğiyle çağrılır. */
  async approveReport(reportId: string, tenantId: string, userId: string, nitelikDurumu: '0' | '1', tarih: Date) {
    const report = await this.prisma.sgkReport.findFirst({
      where: { id: reportId, workplace: { company: { tenantId } } },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');
    const result = { select: { id: true, status: true, approvedAt: true } } as const;
    if (report.status === 'APPROVED') return this.prisma.sgkReport.findUniqueOrThrow({ where: { id: report.id }, ...result });

    const { creds } = await this.credentialsFor(report.workplaceId, userId);
    const token = await this.client.login(creds);
    await this.client.approve(creds, token, {
      tckn: report.tckn,
      vaka: report.vaka,
      medulaRaporId: report.medulaRaporId,
      nitelikDurumu,
      tarih,
    });
    await this.audit.log({
      tenantId,
      userId,
      action: 'vizite.report.approve',
      target: report.id,
      detail: { medulaRaporId: report.medulaRaporId, nitelikDurumu, mode: this.client.mode },
    });
    return this.prisma.sgkReport.update({
      where: { id: report.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
      ...result,
    });
  }
}
