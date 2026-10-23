import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { OutboxService } from '../../../platform/events/outbox.service.js';
import { TEBLIGAT_IMPORTED, type TebligatImported } from '../domain/events.js';
import type { RawTable } from '../../../shared-kernel/table-text.js';
import { parseTebligatTables } from '../infrastructure/tebligat-parser.js';


@Injectable()
export class TebligatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Eklentinin okuduğu tabloları içe aktarır. Sayfada VKN sütunu yoksa (mükellefin kendi oturumu)
   * fallbackTaxNumber kullanılır; o da yoksa needsTaxNumber=true döner ve hiçbir şey yazılmaz.
   */
  async importTables(tenantId: string, tables: RawTable[], dryRun: boolean, fallbackTaxNumber?: string) {
    const parsed = parseTebligatTables(tables);
    const empty = { dryRun, tablesUsed: parsed.tablesUsed, recognized: parsed.tebligats.length, create: 0, update: 0, unchanged: 0, unreadableDates: parsed.unreadableDates, unmatchedTaxNumbers: [] as string[], items: [] as unknown[] };
    if (!parsed.tablesUsed) return { ...empty, needsTaxNumber: false };

    const fallback = fallbackTaxNumber?.replace(/\D/g, '');
    const needsTaxNumber = parsed.tebligats.some((t) => !t.taxNumber) && !(fallback && (fallback.length === 10 || fallback.length === 11));
    if (needsTaxNumber) return { ...empty, needsTaxNumber: true };

    const rows = parsed.tebligats.map((t) => ({ ...t, taxNumber: t.taxNumber ?? fallback! }));
    const companies = await this.prisma.company.findMany({
      where: { tenantId, taxNumber: { in: [...new Set(rows.map((r) => r.taxNumber))] } },
      select: { id: true, title: true, taxNumber: true },
    });
    const byVkn = new Map(companies.map((c) => [c.taxNumber, c]));
    const existing = await this.prisma.eTebligat.findMany({
      where: { companyId: { in: companies.map((c) => c.id) }, documentNo: { in: rows.map((r) => r.documentNo) } },
      select: { id: true, companyId: true, documentNo: true, readAtGib: true },
    });
    const existingKey = new Map(existing.map((e) => [`${e.companyId}|${e.documentNo}`, e]));

    const unmatched = new Set<string>();
    const items: { company: string; subject: string | null; deliveredAt: Date; deemedServedAt: Date; action: 'create' | 'update' | 'unchanged' }[] = [];
    const createdByCompany = new Map<string, { title: string; rows: typeof rows }>();

    for (const r of rows) {
      const c = byVkn.get(r.taxNumber);
      if (!c) {
        unmatched.add(r.taxNumber);
        continue;
      }
      const ex = existingKey.get(`${c.id}|${r.documentNo}`);
      const action = !ex ? 'create' : !ex.readAtGib && r.readAtGib ? 'update' : 'unchanged';
      items.push({ company: c.title, subject: r.subject, deliveredAt: r.deliveredAt, deemedServedAt: r.deemedServedAt, action });
      if (dryRun || action === 'unchanged') continue;

      if (action === 'create') {
        await this.prisma.eTebligat.create({
          data: {
            companyId: c.id,
            documentNo: r.documentNo,
            sender: r.sender,
            subject: r.subject,
            deliveredAt: r.deliveredAt,
            deemedServedAt: r.deemedServedAt,
            readAtGib: r.readAtGib,
            source: 'EXTENSION',
            raw: { sender: r.sender, subject: r.subject, documentNoDerived: r.documentNoDerived },
          },
        });
        const g = createdByCompany.get(c.id) ?? { title: c.title, rows: [] };
        g.rows.push(r);
        createdByCompany.set(c.id, g);
      } else {
        await this.prisma.eTebligat.update({ where: { id: ex!.id }, data: { readAtGib: r.readAtGib } });
      }
    }

    // Yeni tebligatlar için firma başına bir olay (bildirim notifications context'inde üretilir)
    for (const [companyId, g] of createdByCompany) {
      const first = g.rows.sort((a, b) => a.deemedServedAt.getTime() - b.deemedServedAt.getTime())[0];
      const payload: TebligatImported = {
        companyId,
        companyTitle: g.title,
        count: g.rows.length,
        first: { subject: first.subject, sender: first.sender, deemedServedAt: first.deemedServedAt.toISOString() },
      };
      await this.outbox.publish({ type: TEBLIGAT_IMPORTED, tenantId, payload });
    }

    const count = (a: (typeof items)[number]['action']) => items.filter((i) => i.action === a).length;
    return {
      ...empty,
      needsTaxNumber: false,
      create: count('create'),
      update: count('update'),
      unchanged: count('unchanged'),
      unmatchedTaxNumbers: [...unmatched],
      items: items.slice(0, 200),
    };
  }

  list(tenantId: string, opts: { status?: 'open' | 'all'; days?: number; q?: string }) {
    const since = new Date(Date.now() - Math.min(opts.days ?? 90, 730) * 86_400_000);
    return this.prisma.eTebligat.findMany({
      where: {
        company: {
          tenantId,
          ...(opts.q ? { OR: [{ title: { contains: opts.q, mode: 'insensitive' as const } }, { taxNumber: { contains: opts.q } }] } : {}),
        },
        deliveredAt: { gte: since },
        ...(opts.status === 'open' ? { reviewedAt: null } : {}),
      },
      select: {
        id: true,
        documentNo: true,
        sender: true,
        subject: true,
        deliveredAt: true,
        deemedServedAt: true,
        readAtGib: true,
        reviewedAt: true,
        source: true,
        company: { select: { id: true, title: true, taxNumber: true } },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 500,
    });
  }

  /** Dashboard kartı: ulaşma tarihine göre bugün / bu hafta / bu ay / bu yıl, incelenmemiş sayısı. */
  async summary(tenantId: string, now = new Date()) {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const where = (from: Date) => ({ company: { tenantId }, deliveredAt: { gte: from } });
    const [today, week, month, year, open] = await Promise.all([
      this.prisma.eTebligat.count({ where: where(startOfDay) }),
      this.prisma.eTebligat.count({ where: where(startOfWeek) }),
      this.prisma.eTebligat.count({ where: where(startOfMonth) }),
      this.prisma.eTebligat.count({ where: where(startOfYear) }),
      this.prisma.eTebligat.count({ where: { company: { tenantId }, reviewedAt: null } }),
    ]);
    return { today, week, month, year, open };
  }

  async setReviewed(tenantId: string, userId: string, id: string, reviewed: boolean) {
    const { count } = await this.prisma.eTebligat.updateMany({
      where: { id, company: { tenantId } },
      data: reviewed ? { reviewedAt: new Date(), reviewedById: userId } : { reviewedAt: null, reviewedById: null },
    });
    if (!count) throw new NotFoundException('Tebligat bulunamadı');
  }
}
