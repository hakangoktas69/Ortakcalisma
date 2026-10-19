import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../audit.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { DeclarationsService } from '../declarations/declarations.service.js';
import { DECLARATION_INFO, parseControlMonth } from '../declarations/declaration-rules.js';
import { EDefterService, defaultBeratMonth } from '../edefter/edefter.service.js';
import { toCsv, trDate } from './csv.js';

const COMPANY_TYPE: Record<string, string> = { SIRKET: 'Şirket', SAHIS: 'Şahıs', BASIT_USUL: 'Basit Usul' };
const STATUS: Record<string, string> = {
  FILED: 'Verildi',
  FILED_LATE: 'Geç verildi',
  PENDING: 'Bekliyor',
  LATE: 'Gecikti',
  NO_DATE: 'Son gün girilmeli',
  APPROVED: 'Onaylı',
};

export const REPORT_KINDS = ['firmalar', 'beyanname', 'tebligat', 'sgk-rapor', 'ise-giris-cikis', 'edefter'] as const;
type Kind = (typeof REPORT_KINDS)[number];

/**
 * Excel'de açılan CSV raporları. Her indirme denetim kaydına yazılır (kişisel veri içerebilir).
 * ?month=2026-09 (beyanname, edefter), ?days=90 (tebligat, ise-giris-cikis)
 */
@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly declarations: DeclarationsService,
    private readonly edefter: EDefterService,
  ) {}

  @Get(':kind')
  async report(
    @CurrentUser() user: AuthUser,
    @Param('kind') kind: string,
    @Res({ passthrough: true }) res: Response,
    @Query('month') month?: string,
    @Query('days') daysRaw?: string,
  ) {
    if (!REPORT_KINDS.includes(kind as Kind)) throw new BadRequestException('Bilinmeyen rapor');
    const tenantId = user.tenantId;
    const days = Math.min(Math.max(Number(daysRaw) || 90, 1), 730);
    const since = new Date(Date.now() - days * 86_400_000);
    let headers: string[] = [];
    let rows: unknown[][] = [];
    let suffix = '';

    switch (kind as Kind) {
      case 'firmalar': {
        const companies = await this.prisma.company.findMany({
          where: { tenantId },
          orderBy: { title: 'asc' },
          select: {
            title: true,
            taxNumber: true,
            taxOffice: true,
            type: true,
            isActive: true,
            eDefterEnabled: true,
            phone: true,
            email: true,
            _count: { select: { sgkWorkplaces: true } },
          },
        });
        headers = ['Unvan', 'VKN/TCKN', 'Vergi dairesi', 'Tür', 'Durum', 'e-Defter', 'SGK işyeri', 'Telefon', 'E-posta'];
        rows = companies.map((c) => [
          c.title,
          c.taxNumber,
          c.taxOffice,
          COMPANY_TYPE[c.type],
          c.isActive ? 'Aktif' : 'Pasif',
          c.eDefterEnabled ? 'Evet' : 'Hayır',
          c._count.sgkWorkplaces,
          c.phone,
          c.email,
        ]);
        break;
      }
      case 'beyanname': {
        const { year, month: m } = parseControlMonth(month);
        const ctl = await this.declarations.control(tenantId, year, m);
        headers = ['Firma', 'VKN/TCKN', 'Beyanname', 'Dönem', 'Son gün', 'Durum', 'Verilme tarihi', 'Tahakkuk (TL)', 'Kaynak'];
        rows = ctl.rows.flatMap((r) =>
          r.cells.map((c) => [
            r.company.title,
            r.company.taxNumber,
            DECLARATION_INFO[c.type].label,
            c.period,
            trDate(c.dueDate),
            STATUS[c.status],
            trDate(c.declaration?.filedAt),
            c.declaration?.accrualAmount ?? null,
            c.declaration ? { MANUAL: 'Elle', GIB: 'GİB (demo)', EXTENSION: 'GİB sayfası' }[c.declaration.source] : '',
          ]),
        );
        suffix = `${year}-${String(m).padStart(2, '0')}`;
        break;
      }
      case 'tebligat': {
        const list = await this.prisma.eTebligat.findMany({
          where: { company: { tenantId }, deliveredAt: { gte: since } },
          orderBy: { deliveredAt: 'desc' },
          include: { company: { select: { title: true, taxNumber: true } } },
        });
        headers = ['Ulaşma', 'Firma', 'VKN/TCKN', 'Belge no', 'Gönderen', 'Konu', 'Tebliğ sayılma', 'GİB okunma', 'Büroda incelendi'];
        rows = list.map((t) => [
          trDate(t.deliveredAt),
          t.company.title,
          t.company.taxNumber,
          t.documentNo,
          t.sender,
          t.subject,
          trDate(t.deemedServedAt),
          trDate(t.readAtGib),
          trDate(t.reviewedAt),
        ]);
        suffix = `son-${days}-gun`;
        break;
      }
      case 'sgk-rapor': {
        const list = await this.prisma.sgkReport.findMany({
          where: { workplace: { company: { tenantId } } },
          orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
          include: { workplace: { select: { registryNo: true, company: { select: { title: true } } } } },
        });
        headers = ['Firma', 'İşyeri sicil', 'Sigortalı', 'T.C. kimlik no', 'Vaka', 'Başlangıç', 'Bitiş', 'İş başı kontrol', 'Tesis', 'Durum'];
        rows = list.map((r) => [
          r.workplace.company.title,
          r.workplace.registryNo,
          r.fullName,
          r.tckn,
          r.vakaAdi,
          trDate(r.startDate),
          trDate(r.endDate),
          trDate(r.workControlDate),
          r.facilityName,
          r.status === 'APPROVED' ? 'Onaylı' : 'Bekliyor',
        ]);
        break;
      }
      case 'ise-giris-cikis': {
        const list = await this.prisma.employmentEvent.findMany({
          where: { workplace: { company: { tenantId } }, eventDate: { gte: since } },
          orderBy: { eventDate: 'desc' },
          include: { workplace: { select: { registryNo: true, company: { select: { title: true } } } } },
        });
        headers = ['Tarih', 'Hareket', 'Firma', 'İşyeri sicil', 'Sigortalı', 'T.C. kimlik no', 'Meslek kodu', 'Ayrılış nedeni'];
        rows = list.map((e) => [
          trDate(e.eventDate),
          e.type === 'ENTRY' ? 'Giriş' : 'Çıkış',
          e.workplace.company.title,
          e.workplace.registryNo,
          e.fullName,
          e.tckn,
          e.occupationCode,
          e.exitReasonCode ? `${e.exitReasonCode} - ${e.exitReason ?? ''}` : '',
        ]);
        suffix = `son-${days}-gun`;
        break;
      }
      case 'edefter': {
        const { year, month: m } = month ? parseControlMonth(month) : defaultBeratMonth();
        const ctl = await this.edefter.control(tenantId, year, m);
        headers = ['Firma', 'VKN/TCKN', 'Dönem', 'Yükleme tercihi', 'Son gün', 'Son gün kaynağı', 'Durum', 'Yükleme tarihi', 'Not'];
        rows = ctl.rows.map((r) => [
          r.company.title,
          r.company.taxNumber,
          r.periodLabel,
          r.company.preference === 'MONTHLY' ? 'Aylık' : 'Geçici vergi dönemi',
          trDate(r.dueDate),
          { rule: 'Kural', override: 'Elle girildi', none: '—' }[r.dueDateSource],
          STATUS[r.status],
          trDate(r.uploadedAt),
          r.note,
        ]);
        suffix = `${year}-${String(m).padStart(2, '0')}`;
        break;
      }
    }

    await this.audit.log({ tenantId, userId: user.sub, action: 'report.export', target: kind, detail: { rows: rows.length, month, days } });
    const filename = `${kind}${suffix ? '-' + suffix : ''}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return toCsv(headers, rows);
  }
}
