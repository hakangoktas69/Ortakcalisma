import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type { DeclarationType } from '../../../generated/prisma/enums.js';
import {
  DECLARATION_INFO,
  DECLARATION_ORDER,
  DEFAULT_OBLIGATIONS,
  expectedForMonth,
  periodLabel,
  statusOf,
  type ControlStatus,
} from '../domain/declaration-rules.js';
import { GIB_SOURCE, type GibDeclarationSource } from '../infrastructure/gib-source.js';
import { parseTables, type RawTable } from '../infrastructure/declaration-table-parser.js';

@Injectable()
export class DeclarationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GIB_SOURCE) private readonly gib: GibDeclarationSource,
  ) {}

  get mode() {
    return this.gib.mode;
  }

  /** Yükümlülüğü hiç tanımlanmamış firmalara türüne göre varsayılanları yazar. */
  async ensureDefaultObligations(tenantId: string) {
    const companies = await this.prisma.company.findMany({
      where: { tenantId, obligations: { none: {} } },
      select: { id: true, type: true },
    });
    if (!companies.length) return;
    await this.prisma.companyObligation.createMany({
      data: companies.flatMap((c) => DEFAULT_OBLIGATIONS[c.type].map((type) => ({ companyId: c.id, type }))),
      skipDuplicates: true,
    });
  }

  /** Kontrol ayı için firma × beyanname matrisi ve tür bazında özet. */
  async control(tenantId: string, year: number, month: number, now = new Date()) {
    await this.ensureDefaultObligations(tenantId);
    const expected = expectedForMonth(year, month);
    const periods = [...new Set(expected.map((e) => e.period))];

    const companies = await this.prisma.company.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        title: true,
        taxNumber: true,
        type: true,
        obligations: { where: { active: true }, select: { type: true } },
        declarations: {
          where: { period: { in: periods } },
          select: { id: true, type: true, period: true, filedAt: true, accrualAmount: true, referenceNo: true, source: true },
        },
      },
      orderBy: { title: 'asc' },
    });

    const summary = new Map<DeclarationType, Record<ControlStatus, number>>();
    const rows = companies.map((c) => {
      const owed = new Set(c.obligations.map((o) => o.type));
      const cells = expected
        .filter((e) => owed.has(e.type))
        .map((e) => {
          const d = c.declarations.find((x) => x.type === e.type && x.period === e.period);
          const status = statusOf(e.dueDate, d?.filedAt, now);
          const s = summary.get(e.type) ?? { FILED: 0, FILED_LATE: 0, PENDING: 0, LATE: 0 };
          s[status]++;
          summary.set(e.type, s);
          return {
            type: e.type,
            period: e.period,
            dueDate: e.dueDate,
            status,
            declaration: d ? { ...d, accrualAmount: d.accrualAmount ? Number(d.accrualAmount) : null } : null,
          };
        });
      return { company: { id: c.id, title: c.title, taxNumber: c.taxNumber, type: c.type }, cells };
    });

    const types = expected
      .filter((e) => summary.has(e.type))
      .sort((a, b) => DECLARATION_ORDER.indexOf(a.type) - DECLARATION_ORDER.indexOf(b.type))
      .map((e) => ({
        type: e.type,
        label: DECLARATION_INFO[e.type].label,
        short: DECLARATION_INFO[e.type].short,
        period: e.period,
        periodLabel: periodLabel(e.period),
        dueDate: e.dueDate,
        counts: summary.get(e.type)!,
      }));

    return {
      mode: this.gib.mode,
      year,
      month,
      periodLabel: periodLabel(`${year}-${String(month).padStart(2, '0')}`),
      types,
      rows,
    };
  }

  /** GİB kaynağından verilmiş beyannameleri çeker. Elle girilmiş kayıtların üzerine yazmaz. */
  async syncFromGib(tenantId: string, year: number, month: number) {
    const companies = await this.prisma.company.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, taxNumber: true },
    });
    const byVkn = new Map(companies.map((c) => [c.taxNumber, c.id]));
    const filed = await this.gib.filed([...byVkn.keys()], year, month);
    let created = 0;
    for (const f of filed) {
      const companyId = byVkn.get(f.taxNumber);
      if (!companyId) continue;
      const existing = await this.prisma.declaration.findUnique({
        where: { companyId_type_period: { companyId, type: f.type, period: f.period } },
        select: { id: true },
      });
      if (existing) continue;
      await this.prisma.declaration.create({
        data: {
          companyId,
          type: f.type,
          period: f.period,
          filedAt: f.filedAt,
          accrualAmount: f.accrualAmount,
          referenceNo: f.referenceNo,
          source: 'GIB',
        },
      });
      created++;
    }
    return { fetched: filed.length, created };
  }

  /**
   * Eklentinin GİB sayfasından okuduğu tabloları içe aktarır. dryRun'da hiçbir şey yazılmaz,
   * sadece ne olacağı döner. Kural: elle girilmiş kaydın yerini GİB sayfasındaki gerçek veri alır;
   * zaten GİB/eklenti kaynaklı kayıt varsa sadece eksik alanları tamamlanır.
   */
  async importTables(tenantId: string, tables: RawTable[], dryRun: boolean) {
    const parsed = parseTables(tables);
    const vkns = [...new Set(parsed.declarations.map((d) => d.taxNumber))];
    const companies = await this.prisma.company.findMany({
      where: { tenantId, taxNumber: { in: vkns } },
      select: {
        id: true,
        title: true,
        taxNumber: true,
        isActive: true,
        declarations: { select: { id: true, type: true, period: true, source: true, accrualAmount: true, referenceNo: true } },
      },
    });
    const byVkn = new Map(companies.map((c) => [c.taxNumber, c]));

    const items: {
      company: string;
      taxNumber: string;
      type: DeclarationType;
      period: string;
      periodLabel: string;
      filedAt: Date | null;
      action: 'create' | 'replace-manual' | 'complete' | 'unchanged';
    }[] = [];
    const unmatched = new Set<string>();

    for (const d of parsed.declarations) {
      const c = byVkn.get(d.taxNumber);
      if (!c) {
        unmatched.add(d.taxNumber);
        continue;
      }
      const existing = c.declarations.find((x) => x.type === d.type && x.period === d.period);
      const action = !existing
        ? 'create'
        : existing.source === 'MANUAL'
          ? 'replace-manual'
          : (d.accrualAmount != null && existing.accrualAmount == null) || (d.referenceNo && !existing.referenceNo)
            ? 'complete'
            : 'unchanged';
      items.push({
        company: c.title,
        taxNumber: c.taxNumber,
        type: d.type,
        period: d.period,
        periodLabel: periodLabel(d.period),
        filedAt: d.filedAt,
        action,
      });

      if (dryRun || action === 'unchanged') continue;
      const data = {
        filedAt: d.filedAt ?? new Date(),
        accrualAmount: d.accrualAmount,
        referenceNo: d.referenceNo,
        source: 'EXTENSION' as const,
      };
      if (action === 'create') {
        await this.prisma.declaration.create({ data: { companyId: c.id, type: d.type, period: d.period, ...data } });
      } else if (action === 'replace-manual') {
        await this.prisma.declaration.update({ where: { id: existing!.id }, data: { ...data, note: null, createdById: null } });
      } else {
        await this.prisma.declaration.update({
          where: { id: existing!.id },
          data: {
            ...(existing!.accrualAmount == null && d.accrualAmount != null ? { accrualAmount: d.accrualAmount } : {}),
            ...(!existing!.referenceNo && d.referenceNo ? { referenceNo: d.referenceNo } : {}),
          },
        });
      }
    }

    const count = (a: (typeof items)[number]['action']) => items.filter((i) => i.action === a).length;
    return {
      dryRun,
      tablesFound: tables.length,
      tablesUsed: parsed.tablesUsed,
      recognized: parsed.declarations.length,
      create: count('create'),
      replaceManual: count('replace-manual'),
      complete: count('complete'),
      unchanged: count('unchanged'),
      skippedNotApproved: parsed.skippedNotApproved,
      unmatchedTaxNumbers: [...unmatched],
      unknownTypes: parsed.unknownTypes,
      unknownPeriods: parsed.unknownPeriods,
      ignoredTableHeaders: parsed.ignoredTableHeaders.slice(0, 5),
      items: items.slice(0, 200),
    };
  }

  async markFiled(
    tenantId: string,
    userId: string,
    input: { companyId: string; type: DeclarationType; period: string; filedAt?: Date; accrualAmount?: number; note?: string },
  ) {
    const company = await this.prisma.company.findFirst({ where: { id: input.companyId, tenantId }, select: { id: true } });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const data = {
      filedAt: input.filedAt ?? new Date(),
      accrualAmount: input.accrualAmount ?? null,
      note: input.note ?? null,
      source: 'MANUAL' as const,
      createdById: userId,
    };
    return this.prisma.declaration.upsert({
      where: { companyId_type_period: { companyId: company.id, type: input.type, period: input.period } },
      create: { companyId: company.id, type: input.type, period: input.period, ...data },
      update: data,
      select: { id: true, filedAt: true, source: true },
    });
  }

  /** Sadece elle girilmiş kayıtlar geri alınabilir; GİB'den gelen kayıt silinmez. */
  async unmark(tenantId: string, id: string) {
    const { count } = await this.prisma.declaration.deleteMany({
      where: { id, source: 'MANUAL', company: { tenantId } },
    });
    if (!count) throw new NotFoundException('Elle girilmiş kayıt bulunamadı');
  }

  async obligations(tenantId: string, companyId: string) {
    await this.ensureDefaultObligations(tenantId);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      select: { id: true, title: true, type: true, obligations: { select: { type: true, active: true } } },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    return {
      company: { id: company.id, title: company.title, type: company.type },
      items: DECLARATION_ORDER.map((type) => ({
        type,
        label: DECLARATION_INFO[type].label,
        active: company.obligations.some((o) => o.type === type && o.active),
      })),
    };
  }

  async setObligations(tenantId: string, companyId: string, active: DeclarationType[]) {
    const company = await this.prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true } });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    await this.prisma.$transaction(
      DECLARATION_ORDER.map((type) =>
        this.prisma.companyObligation.upsert({
          where: { companyId_type: { companyId, type } },
          create: { companyId, type, active: active.includes(type) },
          update: { active: active.includes(type) },
        }),
      ),
    );
    return this.obligations(tenantId, companyId);
  }
}
