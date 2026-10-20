import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PERSON_FIELDS, PersonalDataService } from '../../../platform/crypto/personal-data.js';
import { DeclarationsService, DECLARATION_INFO, parseControlMonth, periodLabel, EDefterService, defaultBeratMonth } from '../../tax-filing/index.js';
import { TebligatService } from '../../tebligat/index.js';
import { PayrollService } from '../../payroll/index.js';
import { countInbox, daysUntil, maskTckn, severityForDue, sortInbox, type InboxItem } from '../domain/inbox-items.js';

const iso = (d: Date | string) => new Date(d).toISOString();

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personal: PersonalDataService,
    private readonly declarations: DeclarationsService,
    private readonly tebligat: TebligatService,
    private readonly edefter: EDefterService,
    private readonly payroll: PayrollService,
  ) {}

  /** Bütün modüllerden açık işleri toplar. Ertelenmiş olanlar da döner (snoozedUntil dolu); süzme istemcide. */
  async list(tenantId: string, now = new Date()) {
    const items: InboxItem[] = [];

    // 1) Verilmemiş beyannameler (varsayılan kontrol ayı)
    const { year, month } = parseControlMonth(undefined, now);
    const control = await this.declarations.control(tenantId, year, month, now);
    for (const row of control.rows) {
      for (const cell of row.cells) {
        if (cell.status !== 'PENDING' && cell.status !== 'LATE') continue;
        const due = new Date(cell.dueDate);
        const info = DECLARATION_INFO[cell.type];
        items.push({
          key: `decl:${row.company.id}:${cell.type}:${cell.period}`,
          kind: 'declaration',
          severity: severityForDue(due, now, cell.status === 'LATE'),
          title: cell.status === "LATE" ? `${info.short} süresi geçti` : `${info.short} henüz verilmedi`,
          subtitle: `${periodLabel(cell.period)} · son gün ${due.toLocaleDateString('tr-TR')}`,
          company: { id: row.company.id, title: row.company.title, taxNumber: row.company.taxNumber },
          dueDate: iso(due),
          date: iso(due),
          detail: { type: cell.type, label: info.label, period: cell.period, periodLabel: periodLabel(cell.period), daysLeft: daysUntil(due, now) },
          snoozedUntil: null,
        });
      }
    }

    // 2) İncelenmemiş e-tebligatlar
    const tebligats = await this.tebligat.list(tenantId, { status: 'open', days: 120 });
    for (const t of tebligats) {
      const delivered = new Date(t.deliveredAt);
      const fresh = daysUntil(delivered, now) >= -1; // bugün veya dün geldi
      items.push({
        key: `teb:${t.id}`,
        kind: 'tebligat',
        severity: fresh ? 'soon' : 'normal',
        title: t.subject ?? 'e-Tebligat',
        subtitle: `${t.sender ?? 'Gönderen belirtilmemiş'} · ${delivered.toLocaleDateString('tr-TR')}`,
        company: t.company ? { id: t.company.id, title: t.company.title, taxNumber: t.company.taxNumber } : null,
        dueDate: null,
        date: iso(delivered),
        detail: {
          tebligatId: t.id,
          documentNo: t.documentNo,
          sender: t.sender,
          subject: t.subject,
          deliveredAt: iso(delivered),
          deemedServedAt: iso(t.deemedServedAt),
          readAtGib: t.readAtGib ? iso(t.readAtGib) : null,
        },
        snoozedUntil: null,
      });
    }

    // 3) Onay bekleyen e-raporlar
    const reports = await this.prisma.sgkReport.findMany({
      where: { status: 'PENDING', workplace: { company: { tenantId } } },
      select: {
        id: true,
        ...PERSON_FIELDS,
        vakaAdi: true,
        vaka: true,
        startDate: true,
        endDate: true,
        workControlDate: true,
        createdAt: true,
        workplace: { select: { name: true, registryNo: true, company: { select: { id: true, title: true, taxNumber: true } } } },
      },
      orderBy: { startDate: 'desc' },
      take: 200,
    });
    for (const r of reports) {
      const p = this.personal.open(r);
      items.push({
        key: `rapor:${r.id}`,
        kind: 'report',
        severity: 'normal',
        title: `e-Rapor onayı: ${p.fullName}`,
        subtitle: `${r.vakaAdi ?? 'Rapor'}${r.startDate ? ` · ${r.startDate.toLocaleDateString('tr-TR')}–${r.endDate?.toLocaleDateString('tr-TR') ?? ''}` : ''}`,
        company: r.workplace.company,
        dueDate: null,
        date: iso(r.startDate ?? r.createdAt),
        detail: {
          fullName: p.fullName,
          tckn: maskTckn(p.tckn),
          vaka: r.vakaAdi ?? String(r.vaka),
          startDate: r.startDate ? iso(r.startDate) : null,
          endDate: r.endDate ? iso(r.endDate) : null,
          workControlDate: r.workControlDate ? iso(r.workControlDate) : null,
          workplace: r.workplace.name ?? r.workplace.registryNo,
        },
        snoozedUntil: null,
      });
    }

    // 4) Yüklenmemiş e-Defter beratları
    const bm = defaultBeratMonth(now);
    const berats = await this.edefter.control(tenantId, bm.year, bm.month, now);
    for (const b of berats.rows) {
      if (b.status !== 'PENDING' && b.status !== 'LATE') continue;
      items.push({
        key: `berat:${b.company.id}:${b.period}`,
        kind: 'berat',
        severity: severityForDue(b.dueDate, now, b.status === 'LATE'),
        title: 'e-Defter beratı yüklenmedi',
        subtitle: `${b.periodLabel}${b.dueDate ? ` · son gün ${b.dueDate.toLocaleDateString('tr-TR')}` : ''}`,
        company: { id: b.company.id, title: b.company.title, taxNumber: b.company.taxNumber },
        dueDate: b.dueDate ? iso(b.dueDate) : null,
        date: b.dueDate ? iso(b.dueDate) : iso(now),
        detail: { period: b.period, periodLabel: b.periodLabel, daysLeft: b.dueDate ? daysUntil(b.dueDate, now) : null },
        snoozedUntil: null,
      });
    }

    // 5) Bordro: e-Bildirge ile uyuşmayanlar ve e-Bildirge'si olup bordrosu yüklenmeyenler (geçen ay)
    const pd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const payPeriod = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
    const pay = await this.payroll.overview(tenantId, payPeriod);
    for (const run of pay.items as unknown as {
      id: string;
      company: { id: string; title: string; taxNumber: string };
      workplace: { registryNo: string } | null;
      createdAt: Date;
      reconciliation: { status: string; diffs: string[] };
    }[]) {
      if (run.reconciliation.status !== 'MISMATCH') continue;
      items.push({
        key: `bordro:${run.id}`,
        kind: 'payroll',
        severity: 'normal',
        title: 'Bordro e-Bildirge ile uyuşmuyor',
        subtitle: `${periodLabel(payPeriod)} · ${run.reconciliation.diffs.length} fark`,
        company: run.company,
        dueDate: null,
        date: iso(run.createdAt),
        detail: { runId: run.id, period: payPeriod, diffs: run.reconciliation.diffs },
        snoozedUntil: null,
      });
    }
    for (const m of pay.missing) {
      items.push({
        key: `bordro-eksik:${m.id}:${payPeriod}`,
        kind: 'payroll',
        severity: 'normal',
        title: 'Bordro yüklenmedi',
        subtitle: `${periodLabel(payPeriod)} · e-Bildirge'si verilmiş`,
        company: { id: m.company.id, title: m.company.title, taxNumber: '' },
        dueDate: null,
        date: iso(now),
        detail: { period: payPeriod, workplace: m.name ?? m.registryNo },
        snoozedUntil: null,
      });
    }

    // 6) Lisans
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (sub) {
      const left = daysUntil(sub.expiresAt, now);
      if (left <= 30)
        items.push({
          key: `lisans:${sub.expiresAt.toISOString().slice(0, 10)}`,
          kind: 'license',
          severity: left <= 7 ? 'late' : 'soon',
          title: left < 0 ? 'Lisans süresi doldu' : `Lisansın bitmesine ${left} gün kaldı`,
          subtitle: `Bitiş ${sub.expiresAt.toLocaleDateString('tr-TR')}`,
          company: null,
          dueDate: iso(sub.expiresAt),
          date: iso(sub.expiresAt),
          detail: { expiresAt: iso(sub.expiresAt), daysLeft: left },
          snoozedUntil: null,
        });
    }

    // Ertelemeler
    const snoozes = await this.prisma.inboxSnooze.findMany({ where: { tenantId, until: { gt: now } } });
    const until = new Map(snoozes.map((s) => [s.key, iso(s.until)]));
    for (const i of items) i.snoozedUntil = until.get(i.key) ?? null;

    const sorted = sortInbox(items);
    return { generatedAt: iso(now), counts: countInbox(sorted, now), items: sorted };
  }

  async snooze(tenantId: string, userId: string, key: string, until: Date) {
    await this.prisma.inboxSnooze.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, until, userId },
      update: { until, userId },
    });
    return { ok: true, until: iso(until) };
  }

  async unsnooze(tenantId: string, key: string) {
    await this.prisma.inboxSnooze.deleteMany({ where: { tenantId, key } });
    return { ok: true };
  }
}
