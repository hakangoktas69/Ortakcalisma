import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type { EDefterPreference } from '../generated/prisma/enums.js';
import { statusOf, type ControlStatus } from '../declarations/declaration-rules.js';
import { eDefterPeriodLabel, periodForMonth, ruleDueDate } from './edefter-rules.js';

export type BeratStatus = ControlStatus | 'NO_DATE';

/** Varsayılan kontrol ayı: aylık beratın son günü bu aya denk gelen dönem (bugünden 4 ay önce). */
export function defaultBeratMonth(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 4, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

@Injectable()
export class EDefterService {
  constructor(private readonly prisma: PrismaService) {}

  /** Seçilen ay için e-Defter kullanan aktif firmaların berat durumu. */
  async control(tenantId: string, year: number, month: number, now = new Date()) {
    const companies = await this.prisma.company.findMany({
      where: { tenantId, isActive: true, eDefterEnabled: true },
      select: { id: true, title: true, taxNumber: true, type: true, eDefterPreference: true },
      orderBy: { title: 'asc' },
    });
    const wanted = companies
      .map((c) => ({ c, period: periodForMonth(year, month, c.eDefterPreference) }))
      .filter((x): x is { c: (typeof companies)[number]; period: string } => !!x.period);

    const berats = await this.prisma.eDefterBerat.findMany({
      where: { OR: wanted.map((w) => ({ companyId: w.c.id, period: w.period })) },
    });
    const byKey = new Map(berats.map((b) => [`${b.companyId}|${b.period}`, b]));

    const counts: Record<BeratStatus, number> = { FILED: 0, FILED_LATE: 0, PENDING: 0, LATE: 0, NO_DATE: 0 };
    const rows = wanted.map(({ c, period }) => {
      const b = byKey.get(`${c.id}|${period}`);
      const ruleDate = ruleDueDate(period, c.type);
      const dueDate = b?.dueDateOverride ?? ruleDate;
      const status: BeratStatus = dueDate ? statusOf(dueDate, b?.uploadedAt, now) : b?.uploadedAt ? 'FILED' : 'NO_DATE';
      counts[status]++;
      return {
        company: { id: c.id, title: c.title, taxNumber: c.taxNumber, type: c.type, preference: c.eDefterPreference },
        period,
        periodLabel: eDefterPeriodLabel(period),
        dueDate,
        dueDateSource: b?.dueDateOverride ? ('override' as const) : ruleDate ? ('rule' as const) : ('none' as const),
        uploadedAt: b?.uploadedAt ?? null,
        note: b?.note ?? null,
        status,
      };
    });

    const skipped = companies.length - wanted.length; // dönemsel yükleyip bu ay çeyrek sonu olmayanlar
    return { year, month, monthLabel: eDefterPeriodLabel(`${year}-${String(month).padStart(2, '0')}`), counts, rows, skipped, enabledCompanies: companies.length };
  }

  private async own(tenantId: string, companyId: string) {
    const c = await this.prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } });
    if (!c) throw new NotFoundException('Firma bulunamadı');
  }

  /** Yüklendi işareti, son gün düzeltmesi ve not. uploadedAt: null → işareti kaldırır. */
  async update(
    tenantId: string,
    userId: string,
    companyId: string,
    period: string,
    patch: { uploadedAt?: Date | null; dueDateOverride?: Date | null; note?: string | null },
  ) {
    await this.own(tenantId, companyId);
    return this.prisma.eDefterBerat.upsert({
      where: { companyId_period: { companyId, period } },
      create: { companyId, period, ...patch, updatedById: userId },
      update: { ...patch, updatedById: userId },
    });
  }

  async settings(tenantId: string, companyId: string, enabled: boolean, preference: EDefterPreference) {
    await this.own(tenantId, companyId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: { eDefterEnabled: enabled, eDefterPreference: preference },
      select: { id: true, eDefterEnabled: true, eDefterPreference: true },
    });
  }

  /** Ayarlar ekranı için tüm aktif firmaların e-Defter durumu. */
  companies(tenantId: string) {
    return this.prisma.company.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, title: true, taxNumber: true, type: true, eDefterEnabled: true, eDefterPreference: true },
      orderBy: { title: 'asc' },
    });
  }
}
