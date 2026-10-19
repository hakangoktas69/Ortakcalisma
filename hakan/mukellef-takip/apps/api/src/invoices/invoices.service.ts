import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { InvoiceDirection } from '../generated/prisma/enums.js';
import { parseUblInvoice, type ParsedInvoice } from './ubl-parser.js';
import { readInvoiceFiles, type UploadedInvoiceFile } from './invoice-files.js';

const LIST_CAP = 50;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface KdvBucket {
  count: number;
  base: number;
  vat: number;
  withholding: number;
  byRate: { rate: number; base: number; vat: number }[];
  returns: number; // İADE tipindeki fatura sayısı
}

/** Faturaları yön ve KDV oranına göre toplar (TL karşılığıyla). Kur bilgisi olmayan dövizli faturalar atlanır. */
export function kdvBuckets(rows: { direction: InvoiceDirection; invoiceType: string; exchangeRate: number | null; taxExclusiveAmount: number; vatAmount: number; withholdingAmount: number; taxes: unknown }[]) {
  const empty = (): KdvBucket & { rates: Map<number, { base: number; vat: number }> } => ({ count: 0, base: 0, vat: 0, withholding: 0, byRate: [], returns: 0, rates: new Map() });
  const out = { OUTGOING: empty(), INCOMING: empty() };
  let missingRate = 0;
  for (const r of rows) {
    if (r.exchangeRate === null) {
      missingRate++;
      continue;
    }
    const k = r.exchangeRate;
    const b = out[r.direction];
    b.count++;
    if (r.invoiceType === 'IADE') b.returns++;
    b.base += r.taxExclusiveAmount * k;
    b.vat += r.vatAmount * k;
    b.withholding += r.withholdingAmount * k;
    for (const t of (Array.isArray(r.taxes) ? r.taxes : []) as { code: string; rate: number | null; base: number; amount: number }[]) {
      if (t.code !== '0015') continue;
      const g = b.rates.get(t.rate ?? 0) ?? { base: 0, vat: 0 };
      g.base += t.base * k;
      g.vat += t.amount * k;
      b.rates.set(t.rate ?? 0, g);
    }
  }
  const finish = ({ rates, ...b }: ReturnType<typeof empty>): KdvBucket => ({
    ...b,
    base: round2(b.base),
    vat: round2(b.vat),
    withholding: round2(b.withholding),
    byRate: [...rates.entries()].sort((a, c) => c[0] - a[0]).map(([rate, g]) => ({ rate, base: round2(g.base), vat: round2(g.vat) })),
  });
  const sales = finish(out.OUTGOING);
  const purchases = finish(out.INCOMING);
  return {
    sales,
    purchases,
    missingRate,
    calculatedVat: sales.vat,
    // Tevkifatlı satışta tevkif edilen kısmı alıcı beyan eder; satıcı bu kısmı ödemez
    salesWithholding: sales.withholding,
    // Alıcı, tevkif ettiği kısım dahil faturadaki KDV'nin tamamını indirim konusu yapar
    deductibleVat: purchases.vat,
    // Alıcı sıfatıyla tevkif edilip 2 No.lu KDV beyannamesiyle beyan edilecek tutar
    kdv2: purchases.withholding,
    difference: round2(sales.vat - sales.withholding - purchases.vat),
  };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Yüklenen UBL-TR XML/ZIP dosyalarını aktarır. Fatura, satıcı VKN'si portaldaki bir mükellefe uyuyorsa
   * o mükellefin satışı, alıcı VKN'si uyuyorsa alışı olarak kaydedilir (ikisi de uyarsa iki kayıt).
   * Aynı ETTN tekrar yüklenirse atlanır.
   */
  async importFiles(tenantId: string, files: UploadedInvoiceFile[], dryRun: boolean) {
    const { xmls, skipped } = await readInvoiceFiles(files);
    const parsed: { name: string; inv: ParsedInvoice }[] = [];
    const errors: { name: string; error: string }[] = [];
    for (const x of xmls) {
      const r = parseUblInvoice(x.content);
      if (r.ok) parsed.push({ name: x.name, inv: r.invoice });
      else errors.push({ name: x.name, error: r.error });
    }

    const companies = await this.prisma.company.findMany({ where: { tenantId }, select: { id: true, title: true, taxNumber: true } });
    const byVkn = new Map(companies.map((c) => [c.taxNumber, c]));

    type Row = { companyId: string; direction: InvoiceDirection; inv: ParsedInvoice };
    const rows: Row[] = [];
    const unmatched = new Map<string, { taxNumber: string; name: string | null; count: number }>();
    const seen = new Set<string>();
    let duplicateInUpload = 0;
    let unmatchedInvoices = 0;
    for (const { inv } of parsed) {
      const hits: Row[] = [];
      const seller = inv.supplier.taxNumber ? byVkn.get(inv.supplier.taxNumber) : undefined;
      const buyer = inv.customer.taxNumber ? byVkn.get(inv.customer.taxNumber) : undefined;
      if (seller) hits.push({ companyId: seller.id, direction: 'OUTGOING', inv });
      if (buyer) hits.push({ companyId: buyer.id, direction: 'INCOMING', inv });
      if (!hits.length) {
        unmatchedInvoices++;
        for (const p of [inv.supplier, inv.customer]) {
          if (!p.taxNumber) continue;
          const u = unmatched.get(p.taxNumber) ?? { taxNumber: p.taxNumber, name: p.name, count: 0 };
          u.count++;
          unmatched.set(p.taxNumber, u);
        }
        continue;
      }
      for (const h of hits) {
        const key = `${h.companyId}|${h.direction}|${h.inv.uuid}`;
        if (seen.has(key)) {
          duplicateInUpload++;
          continue;
        }
        seen.add(key);
        rows.push(h);
      }
    }

    const existing = rows.length
      ? await this.prisma.invoice.findMany({
          where: { companyId: { in: [...new Set(rows.map((r) => r.companyId))] }, uuid: { in: [...new Set(rows.map((r) => r.inv.uuid))] } },
          select: { companyId: true, direction: true, uuid: true },
        })
      : [];
    const existingKeys = new Set(existing.map((e) => `${e.companyId}|${e.direction}|${e.uuid}`));
    const toCreate = rows.filter((r) => !existingKeys.has(`${r.companyId}|${r.direction}|${r.inv.uuid}`));

    if (!dryRun && toCreate.length) {
      const data: Prisma.InvoiceCreateManyInput[] = toCreate.map(({ companyId, direction, inv }) => {
        const counterparty = direction === 'OUTGOING' ? inv.customer : inv.supplier;
        return {
          companyId,
          direction,
          uuid: inv.uuid,
          number: inv.number,
          issueDate: new Date(`${inv.issueDate}T00:00:00Z`),
          period: inv.issueDate.slice(0, 7),
          profile: inv.profile,
          invoiceType: inv.invoiceType,
          counterpartyTaxNumber: counterparty.taxNumber,
          counterpartyName: counterparty.name?.slice(0, 300) ?? null,
          currency: inv.currency,
          exchangeRate: inv.exchangeRate,
          lineExtensionAmount: inv.lineExtensionAmount,
          taxExclusiveAmount: inv.taxExclusiveAmount,
          taxInclusiveAmount: inv.taxInclusiveAmount,
          payableAmount: inv.payableAmount,
          vatAmount: inv.vatAmount,
          withholdingAmount: inv.withholdingAmount,
          taxes: inv.taxes as unknown as Prisma.InputJsonValue,
          lineCount: inv.lineCount,
          source: 'UBL_UPLOAD',
        };
      });
      for (let i = 0; i < data.length; i += 500) await this.prisma.invoice.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
    }

    const title = new Map(companies.map((c) => [c.id, c.title]));
    const perCompany = new Map<string, { companyId: string; company: string; outgoing: number; incoming: number }>();
    for (const r of toCreate) {
      const p = perCompany.get(r.companyId) ?? { companyId: r.companyId, company: title.get(r.companyId) ?? '', outgoing: 0, incoming: 0 };
      if (r.direction === 'OUTGOING') p.outgoing++;
      else p.incoming++;
      perCompany.set(r.companyId, p);
    }

    return {
      dryRun,
      files: xmls.length,
      recognized: parsed.length,
      create: toCreate.length,
      duplicate: rows.length - toCreate.length + duplicateInUpload,
      foreignWithoutRate: toCreate.filter((r) => r.inv.exchangeRate === null).length,
      byCompany: [...perCompany.values()].sort((a, b) => a.company.localeCompare(b.company, 'tr')),
      unmatched: [...unmatched.values()].sort((a, b) => b.count - a.count).slice(0, LIST_CAP),
      unmatchedInvoices,
      errors: errors.slice(0, LIST_CAP),
      errorCount: errors.length,
      skipped: skipped.slice(0, LIST_CAP),
      skippedCount: skipped.length,
    };
  }

  async list(tenantId: string, q: { companyId?: string; period?: string; direction?: InvoiceDirection; search?: string; skip?: number }) {
    const where: Prisma.InvoiceWhereInput = {
      company: { tenantId },
      ...(q.companyId ? { companyId: q.companyId } : {}),
      ...(q.period ? { period: q.period } : {}),
      ...(q.direction ? { direction: q.direction } : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: 'insensitive' } },
              { counterpartyName: { contains: q.search, mode: 'insensitive' } },
              { counterpartyTaxNumber: { startsWith: q.search } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
        skip: Math.max(0, q.skip ?? 0),
        take: 100,
        select: {
          id: true,
          direction: true,
          uuid: true,
          number: true,
          issueDate: true,
          profile: true,
          invoiceType: true,
          counterpartyTaxNumber: true,
          counterpartyName: true,
          currency: true,
          exchangeRate: true,
          taxExclusiveAmount: true,
          vatAmount: true,
          withholdingAmount: true,
          payableAmount: true,
          source: true,
          company: { select: { id: true, title: true } },
        },
      }),
    ]);
    return {
      total,
      items: items.map((i) => ({
        ...i,
        exchangeRate: i.exchangeRate === null ? null : Number(i.exchangeRate),
        taxExclusiveAmount: Number(i.taxExclusiveAmount),
        vatAmount: Number(i.vatAmount),
        withholdingAmount: Number(i.withholdingAmount),
        payableAmount: Number(i.payableAmount),
      })),
    };
  }

  private async kdvRows(where: Prisma.InvoiceWhereInput) {
    const rows = await this.prisma.invoice.findMany({
      where,
      select: { companyId: true, direction: true, invoiceType: true, exchangeRate: true, taxExclusiveAmount: true, vatAmount: true, withholdingAmount: true, taxes: true },
    });
    return rows.map((r) => ({
      ...r,
      exchangeRate: r.exchangeRate === null ? null : Number(r.exchangeRate),
      taxExclusiveAmount: Number(r.taxExclusiveAmount),
      vatAmount: Number(r.vatAmount),
      withholdingAmount: Number(r.withholdingAmount),
    }));
  }

  /** Dönem özeti: faturası olan her mükellef için satış/alış toplamları ve KDV farkı */
  async overview(tenantId: string, period: string) {
    const rows = await this.kdvRows({ company: { tenantId }, period });
    const companies = await this.prisma.company.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.companyId))] } },
      select: { id: true, title: true, taxNumber: true },
      orderBy: { title: 'asc' },
    });
    return {
      period,
      items: companies.map((c) => {
        const k = kdvBuckets(rows.filter((r) => r.companyId === c.id));
        return {
          company: c,
          salesCount: k.sales.count,
          salesBase: k.sales.base,
          calculatedVat: k.calculatedVat,
          salesWithholding: k.salesWithholding,
          purchasesCount: k.purchases.count,
          purchasesBase: k.purchases.base,
          deductibleVat: k.deductibleVat,
          kdv2: k.kdv2,
          difference: k.difference,
          missingRate: k.missingRate,
        };
      }),
    };
  }

  /** Tek mükellef + dönem için KDV ön kontrolü (oran kırılımıyla) */
  async kdv(tenantId: string, companyId: string, period: string) {
    const company = await this.prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { id: true, title: true, taxNumber: true } });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    return { company, period, ...kdvBuckets(await this.kdvRows({ companyId, period })) };
  }

  async remove(tenantId: string, id: string) {
    const { count } = await this.prisma.invoice.deleteMany({ where: { id, company: { tenantId } } });
    if (!count) throw new NotFoundException('Fatura bulunamadı');
    return { ok: true };
  }
}
