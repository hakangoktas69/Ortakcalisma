import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { readSheet } from '../../../platform/files/spreadsheet.js';
import { PERSON_FIELDS, PersonalDataService } from '../../../platform/crypto/personal-data.js';
import { AuditService } from '../../../platform/audit/audit.service.js';
import { maskTckn } from '../../../shared-kernel/tckn.js';
import { fieldLabel, parsePayrollSheet, type PayrollLineInput } from '../infrastructure/payroll-parser.js';

const MAX_LINES = 5000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export interface PayrollTotals {
  employeeCount: number;
  totalDays: number;
  gross: number;
  sgkBase: number;
  employeeSgk: number;
  employeeUnemployment: number;
  employerSgk: number | null;
  employerUnemployment: number | null;
  incomeTax: number;
  stampTax: number;
  net: number;
  warningCount: number;
}

export function payrollTotals(lines: PayrollLineInput[]): PayrollTotals {
  const sum = (f: (l: PayrollLineInput) => number) => round2(lines.reduce((s, l) => s + f(l), 0));
  const optional = (f: (l: PayrollLineInput) => number | null) => (lines.some((l) => f(l) !== null) ? sum((l) => f(l) ?? 0) : null);
  return {
    employeeCount: lines.length,
    totalDays: lines.reduce((s, l) => s + l.days, 0),
    gross: sum((l) => l.gross),
    sgkBase: sum((l) => l.sgkBase),
    employeeSgk: sum((l) => l.employeeSgk),
    employeeUnemployment: sum((l) => l.employeeUnemployment),
    employerSgk: optional((l) => l.employerSgk),
    employerUnemployment: optional((l) => l.employerUnemployment),
    incomeTax: sum((l) => l.incomeTax),
    stampTax: sum((l) => l.stampTax),
    net: sum((l) => l.net),
    warningCount: lines.filter((l) => l.warnings.length).length,
  };
}

export type ReconcileStatus = 'OK' | 'MISMATCH' | 'NO_EBILDIRGE';

/**
 * Bordro ↔ e-Bildirge mutabakatı: sigortalı sayısı, prim günü ve PEK. Asıl ve ek belgeler toplanır,
 * iptal belgeleri düşülür. PEK'te 1 TL'ye kadar yuvarlama farkı kabul edilir.
 */
export function reconcile(
  payroll: { employeeCount: number; totalDays: number; sgkBase: number },
  docs: { kind: string; insuredCount: number | null; totalDays: number | null; premiumBase: number | null }[],
) {
  if (!docs.length) return { status: 'NO_EBILDIRGE' as ReconcileStatus, ebildirge: null, diffs: [] as string[] };
  const sign = (k: string) => (k === 'IPTAL' ? -1 : 1);
  const eb = {
    insuredCount: docs.filter((d) => d.kind === 'ASIL').reduce((s, d) => s + (d.insuredCount ?? 0), 0),
    totalDays: docs.reduce((s, d) => s + sign(d.kind) * (d.totalDays ?? 0), 0),
    premiumBase: round2(docs.reduce((s, d) => s + sign(d.kind) * (d.premiumBase ?? 0), 0)),
    documents: docs.length,
  };
  const diffs: string[] = [];
  if (eb.insuredCount !== payroll.employeeCount) diffs.push(`Sigortalı sayısı: bordroda ${payroll.employeeCount}, e-Bildirge asıl belgede ${eb.insuredCount}`);
  if (eb.totalDays !== payroll.totalDays) diffs.push(`Prim günü: bordroda ${payroll.totalDays}, e-Bildirge'de ${eb.totalDays}`);
  if (Math.abs(eb.premiumBase - payroll.sgkBase) > 1)
    diffs.push(`PEK: bordroda ${payroll.sgkBase.toFixed(2)}, e-Bildirge'de ${eb.premiumBase.toFixed(2)} (fark ${(payroll.sgkBase - eb.premiumBase).toFixed(2)})`);
  return { status: (diffs.length ? 'MISMATCH' : 'OK') as ReconcileStatus, ebildirge: eb, diffs };
}

const runSelect = {
  id: true,
  period: true,
  source: true,
  fileName: true,
  employeeCount: true,
  totalDays: true,
  gross: true,
  sgkBase: true,
  employeeSgk: true,
  employeeUnemployment: true,
  employerSgk: true,
  employerUnemployment: true,
  incomeTax: true,
  stampTax: true,
  net: true,
  warningCount: true,
  createdAt: true,
  companyId: true,
  workplaceId: true,
  company: { select: { id: true, title: true, taxNumber: true } },
  workplace: { select: { id: true, registryNo: true, name: true } },
} as const;

type RunRow = { [K in keyof typeof runSelect]: unknown } & { companyId: string; workplaceId: string | null; period: string };

function runNumbers<T extends Record<string, unknown>>(r: T) {
  const out: Record<string, unknown> = { ...r };
  for (const k of ['gross', 'sgkBase', 'employeeSgk', 'employeeUnemployment', 'employerSgk', 'employerUnemployment', 'incomeTax', 'stampTax', 'net']) out[k] = num(r[k]);
  return out;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personal: PersonalDataService,
    private readonly audit: AuditService,
  ) {}

  private async target(tenantId: string, companyId: string, workplaceId?: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      select: { id: true, title: true, sgkWorkplaces: { select: { id: true, registryNo: true, name: true } } },
    });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    let workplace = workplaceId ? company.sgkWorkplaces.find((w) => w.id === workplaceId) : undefined;
    if (workplaceId && !workplace) throw new NotFoundException('İşyeri bu firmaya ait değil');
    // Tek işyeri varsa bordro ona aittir
    if (!workplace && company.sgkWorkplaces.length === 1) workplace = company.sgkWorkplaces[0];
    return { company, workplace: workplace ?? null };
  }

  /** e-Bildirge belgeleri: işyeri belliyse o işyerinin, değilse firmanın tüm işyerlerinin */
  private ebildirgeDocs(companyId: string, workplaceId: string | null, period: string) {
    return this.prisma.eBildirgeDocument
      .findMany({
        where: { period, ...(workplaceId ? { workplaceId } : { workplace: { companyId } }) },
        select: { kind: true, insuredCount: true, totalDays: true, premiumBase: true },
      })
      .then((docs) => docs.map((d) => ({ ...d, premiumBase: num(d.premiumBase) })));
  }

  async importFile(
    tenantId: string,
    userId: string,
    file: { originalname: string; buffer: Buffer },
    input: { companyId: string; workplaceId?: string; period: string },
    dryRun: boolean,
  ) {
    const { company, workplace } = await this.target(tenantId, input.companyId, input.workplaceId);
    let sheet;
    try {
      sheet = await readSheet(file.buffer, file.originalname);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Dosya okunamadı');
    }
    const parsed = parsePayrollSheet([{ n: sheet.headerRow ?? 1, cells: sheet.headers }, ...sheet.rows]);
    if (parsed.headerRow === null)
      throw new BadRequestException('Bordro sütunları bulunamadı. Dosyada en az "T.C. Kimlik No", "Gün" ve "SGK Matrahı" başlıkları olmalı (şablonu indirebilirsiniz).');
    if (parsed.missingColumns.length) throw new BadRequestException(`Eksik sütun: ${parsed.missingColumns.map(fieldLabel).join(', ')}`);
    if (!parsed.lines.length) throw new BadRequestException('Dosyada okunabilen personel satırı yok');
    if (parsed.lines.length > MAX_LINES) throw new BadRequestException(`Bir bordroda en fazla ${MAX_LINES} personel olabilir`);

    const totals = payrollTotals(parsed.lines);
    const workplaceKey = workplace?.id ?? '';
    const existing = await this.prisma.payrollRun.findUnique({
      where: { companyId_workplaceKey_period: { companyId: company.id, workplaceKey, period: input.period } },
      select: { id: true, employeeCount: true, source: true },
    });
    const reconciliation = reconcile(totals, await this.ebildirgeDocs(company.id, workplace?.id ?? null, input.period));

    let runId: string | null = null;
    if (!dryRun) {
      runId = await this.prisma.$transaction(async (tx) => {
        if (existing) await tx.payrollRun.delete({ where: { id: existing.id } });
        const run = await tx.payrollRun.create({
          data: {
            companyId: company.id,
            workplaceId: workplace?.id ?? null,
            workplaceKey,
            period: input.period,
            source: 'EXCEL_UPLOAD',
            fileName: file.originalname.slice(0, 200),
            uploadedById: userId,
            ...totals,
          },
        });
        // Çalışan kimlik alanları şifreli yazılır (KVKK)
        const lines = parsed.lines.map(({ row: _row, tckn, fullName, ...l }) => ({ ...l, ...this.personal.seal({ tckn, fullName }), runId: run.id }));
        for (let i = 0; i < lines.length; i += 1000) await tx.payrollLine.createMany({ data: lines.slice(i, i + 1000) });
        return run.id;
      });
    }

    return {
      dryRun,
      runId,
      company: { id: company.id, title: company.title },
      workplace,
      period: input.period,
      replaces: existing ? { employeeCount: existing.employeeCount, source: existing.source } : null,
      headerRow: parsed.headerRow,
      totals,
      reconciliation,
      errors: parsed.errors.slice(0, 50),
      errorCount: parsed.errors.length,
      warnings: parsed.lines
        .filter((l) => l.warnings.length)
        .slice(0, 50)
        .map((l) => ({ row: l.row, fullName: l.fullName, warnings: l.warnings })),
    };
  }

  /** Dönem özeti: yüklenen bordrolar + mutabakat; e-Bildirge'si olup bordrosu olmayan işyerleri */
  async overview(tenantId: string, period: string) {
    const runs = (await this.prisma.payrollRun.findMany({
      where: { period, company: { tenantId } },
      select: runSelect,
      orderBy: [{ company: { title: 'asc' } }],
    })) as unknown as RunRow[];
    const items = [];
    for (const r of runs) {
      const rec = reconcile(
        { employeeCount: r.employeeCount as number, totalDays: r.totalDays as number, sgkBase: Number(r.sgkBase) },
        await this.ebildirgeDocs(r.companyId, r.workplaceId, period),
      );
      items.push({ ...runNumbers(r), reconciliation: rec });
    }

    const covered = new Set(runs.map((r) => r.workplaceId).filter(Boolean));
    const coveredCompanies = new Set(runs.filter((r) => !r.workplaceId).map((r) => r.companyId));
    const withEbildirge = await this.prisma.sgkWorkplace.findMany({
      where: { company: { tenantId }, bildirges: { some: { period } } },
      select: { id: true, registryNo: true, name: true, company: { select: { id: true, title: true } } },
      orderBy: { company: { title: 'asc' } },
    });
    const missing = withEbildirge.filter((w) => !covered.has(w.id) && !coveredCompanies.has(w.company.id));
    return { period, items, missing };
  }

  async run(tenantId: string, id: string, userId?: string) {
    const r = await this.prisma.payrollRun.findFirst({
      where: { id, company: { tenantId } },
      select: {
        ...runSelect,
        lines: {
          select: {
            id: true,
            ...PERSON_FIELDS,
            days: true,
            gross: true,
            sgkBase: true,
            employeeSgk: true,
            employeeUnemployment: true,
            incomeTax: true,
            stampTax: true,
            net: true,
            warnings: true,
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Bordro bulunamadı');
    await this.audit.log({ tenantId, userId, action: 'pii.read', target: 'payroll.run', detail: { runId: id, lines: r.lines.length } });
    // Ad şifreli olduğu için sıralama çözüldükten sonra yapılır; T.C. kimlik no maskeli döner
    const lines = r.lines
      .map(({ tckn: _t, fullName: _f, tcknEnc: _te, fullNameEnc: _fe, ...l }, i) => {
        const p = this.personal.open(r.lines[i]);
        return { ...l, fullName: p.fullName, tckn: maskTckn(p.tckn) };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
    const rec = reconcile({ employeeCount: r.employeeCount, totalDays: r.totalDays, sgkBase: Number(r.sgkBase) }, await this.ebildirgeDocs(r.companyId, r.workplaceId, r.period));
    return {
      ...runNumbers(r as unknown as Record<string, unknown>),
      lines: lines.map((l) => ({
        ...l,
        gross: Number(l.gross),
        sgkBase: Number(l.sgkBase),
        employeeSgk: Number(l.employeeSgk),
        employeeUnemployment: Number(l.employeeUnemployment),
        incomeTax: Number(l.incomeTax),
        stampTax: Number(l.stampTax),
        net: Number(l.net),
      })),
      reconciliation: rec,
    };
  }

  async remove(tenantId: string, id: string) {
    const { count } = await this.prisma.payrollRun.deleteMany({ where: { id, company: { tenantId } } });
    if (!count) throw new NotFoundException('Bordro bulunamadı');
    return { ok: true };
  }

  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bordro');
    ws.addRow(['T.C. Kimlik No', 'Adı Soyadı', 'Gün', 'Brüt Ücret', 'SGK Matrahı', 'SGK İşçi Payı', 'İşsizlik İşçi Payı', 'SGK İşveren Payı', 'İşsizlik İşveren Payı', 'Gelir Vergisi Matrahı', 'Gelir Vergisi', 'Damga Vergisi', 'Net Ücret']);
    ws.getRow(1).font = { bold: true };
    ws.columns = [16, 26, 8, 14, 14, 14, 14, 14, 14, 16, 14, 14, 14].map((width) => ({ width }));
    ws.getColumn(1).numFmt = '@';
    const help = wb.addWorksheet('Açıklama');
    [
      ['Bordro aktarım şablonu'],
      [''],
      ['• Bordro programınızın personel bazlı bordro listesini Excel olarak alın; sütun adları farklıysa da çoğu durumda tanınır.'],
      ['• Zorunlu sütunlar: T.C. Kimlik No, Gün, SGK Matrahı. Diğerleri varsa okunur.'],
      ['• Üstteki firma/dönem başlık satırları ve alttaki TOPLAM satırı sorun değildir; atlanır.'],
      ['• Tutarlar aylıktır. Kümülatif ve istisna sütunları okunmaz.'],
      ['• Aynı firma, işyeri ve dönem için yeniden yükleme eski bordronun yerine geçer.'],
    ].forEach((r) => help.addRow(r));
    help.getColumn(1).width = 110;
    help.getRow(1).font = { bold: true, size: 13 };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
