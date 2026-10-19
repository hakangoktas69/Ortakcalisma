import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service.js';
import type { RawTable } from '../../declarations/import/table-parser.js';
import { parseBildirgeTables, sameRegistry, type ParsedBildirge } from './ebildirge-parser.js';

type Action = 'create' | 'update' | 'unchanged';

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

@Injectable()
export class EBildirgeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Eklentinin SGK sayfasından okuduğu tabloları aktarır.
   * İşyeri şu sırayla bulunur: satırdaki sicil no → kullanıcının eklentide girdiği sicil no →
   * sayfa metninde geçen sicil no (tek bir işyeriyle eşleşiyorsa). Bulunamazsa needsWorkplace döner, hiçbir şey yazılmaz.
   */
  async importTables(tenantId: string, tables: RawTable[], dryRun: boolean, opts: { registryNo?: string; pageRegistryHints?: string[] } = {}) {
    const parsed = parseBildirgeTables(tables);
    const base = {
      dryRun,
      tablesUsed: parsed.tablesUsed,
      recognized: parsed.documents.length,
      create: 0,
      update: 0,
      unchanged: 0,
      unreadablePeriods: parsed.unreadablePeriods,
      unmatchedRegistries: [] as string[],
      needsWorkplace: false,
      workplace: null as null | { id: string; company: string; registryNo: string },
      items: [] as { company: string; period: string; documentType: string; lawNo: string; kind: string; insuredCount: number | null; action: Action }[],
    };
    if (!parsed.tablesUsed || !parsed.documents.length) return base;

    const workplaces = await this.prisma.sgkWorkplace.findMany({
      where: { company: { tenantId } },
      select: { id: true, registryNo: true, company: { select: { title: true } } },
    });
    const find = (digits: string) => workplaces.filter((w) => sameRegistry(w.registryNo, digits));

    // Sayfa geneli için işyeri: kullanıcının girdiği ya da sayfada tek bir işyerine uyan sicil
    let pageWorkplace: (typeof workplaces)[number] | null = null;
    if (opts.registryNo) {
      const m = find(opts.registryNo);
      if (m.length === 1) pageWorkplace = m[0];
      else base.unmatchedRegistries.push(opts.registryNo);
    }
    if (!pageWorkplace && opts.pageRegistryHints?.length) {
      const candidates = new Map(opts.pageRegistryHints.flatMap((h) => find(h)).map((w) => [w.id, w]));
      if (candidates.size === 1) pageWorkplace = [...candidates.values()][0];
    }

    const resolved: { doc: ParsedBildirge; wp: (typeof workplaces)[number] }[] = [];
    const unmatched = new Set<string>();
    for (const doc of parsed.documents) {
      let wp = pageWorkplace;
      if (doc.registryDigits) {
        const m = find(doc.registryDigits);
        wp = m.length === 1 ? m[0] : null;
        if (!wp) unmatched.add(doc.registryDigits);
      }
      if (!wp) {
        if (!doc.registryDigits) return { ...base, needsWorkplace: true, unmatchedRegistries: base.unmatchedRegistries };
        continue;
      }
      resolved.push({ doc, wp });
    }
    base.unmatchedRegistries.push(...unmatched);
    if (pageWorkplace) base.workplace = { id: pageWorkplace.id, company: pageWorkplace.company.title, registryNo: pageWorkplace.registryNo };

    const existing = await this.prisma.eBildirgeDocument.findMany({
      where: { workplaceId: { in: [...new Set(resolved.map((r) => r.wp.id))] }, period: { in: [...new Set(resolved.map((r) => r.doc.period))] } },
    });
    const key = (w: string, d: { period: string; documentType: string; lawNo: string; kind: string }) => `${w}|${d.period}|${d.documentType}|${d.lawNo}|${d.kind}`;
    const byKey = new Map(existing.map((e) => [key(e.workplaceId, e), e]));

    for (const { doc, wp } of resolved) {
      const ex = byKey.get(key(wp.id, doc));
      const data = {
        insuredCount: doc.insuredCount,
        totalDays: doc.totalDays,
        premiumBase: doc.premiumBase,
        accrualAmount: doc.accrualAmount,
        approvedAt: doc.approvedAt,
        referenceNo: doc.referenceNo,
      };
      const same =
        ex &&
        ex.insuredCount === data.insuredCount &&
        ex.totalDays === data.totalDays &&
        num(ex.premiumBase) === data.premiumBase &&
        num(ex.accrualAmount) === data.accrualAmount;
      const action: Action = !ex ? 'create' : same ? 'unchanged' : 'update';
      base.items.push({ company: wp.company.title, period: doc.period, documentType: doc.documentType, lawNo: doc.lawNo, kind: doc.kind, insuredCount: doc.insuredCount, action });
      if (dryRun || action === 'unchanged') continue;
      if (action === 'create') {
        await this.prisma.eBildirgeDocument.create({
          data: { workplaceId: wp.id, period: doc.period, documentType: doc.documentType, lawNo: doc.lawNo, kind: doc.kind, ...data, source: 'EXTENSION', raw: { ...doc, approvedAt: doc.approvedAt?.toISOString() ?? null } },
        });
      } else {
        await this.prisma.eBildirgeDocument.update({ where: { id: ex!.id }, data: { ...data, source: 'EXTENSION' } });
      }
    }
    const n = (a: Action) => base.items.filter((i) => i.action === a).length;
    return { ...base, create: n('create'), update: n('update'), unchanged: n('unchanged'), items: base.items.slice(0, 200) };
  }

  list(tenantId: string, opts: { period?: string; workplaceId?: string; months?: number }) {
    const since = new Date();
    since.setMonth(since.getMonth() - Math.min(opts.months ?? 12, 60));
    const sincePeriod = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}`;
    return this.prisma.eBildirgeDocument.findMany({
      where: {
        workplace: { company: { tenantId } },
        ...(opts.workplaceId ? { workplaceId: opts.workplaceId } : {}),
        ...(opts.period ? { period: opts.period } : { period: { gte: sincePeriod } }),
      },
      orderBy: [{ period: 'desc' }, { documentType: 'asc' }],
      take: 1000,
      select: {
        id: true,
        period: true,
        documentType: true,
        lawNo: true,
        kind: true,
        insuredCount: true,
        totalDays: true,
        premiumBase: true,
        accrualAmount: true,
        approvedAt: true,
        source: true,
        workplace: { select: { id: true, registryNo: true, name: true, company: { select: { title: true } } } },
      },
    });
  }

  /**
   * Dashboard: toplam belge sayısı ve "güncel çalışan" — her işyerinin bildirge verilmiş en son
   * dönemindeki ASIL belgelerin sigortalı sayısı toplamı (ek belgeler aynı kişileri tekrar sayabilir).
   */
  async summary(tenantId: string) {
    const docs = await this.prisma.eBildirgeDocument.findMany({
      where: { workplace: { company: { tenantId } } },
      select: { workplaceId: true, period: true, kind: true, insuredCount: true },
    });
    const latest = new Map<string, string>();
    for (const d of docs) if ((latest.get(d.workplaceId) ?? '') < d.period) latest.set(d.workplaceId, d.period);
    const currentEmployees = docs
      .filter((d) => d.kind === 'ASIL' && latest.get(d.workplaceId) === d.period)
      .reduce((s, d) => s + (d.insuredCount ?? 0), 0);
    return { documents: docs.length, currentEmployees, workplacesWithData: latest.size };
  }
}
