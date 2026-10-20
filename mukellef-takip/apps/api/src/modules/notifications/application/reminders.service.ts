import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { runAsSystem, runAsTenant } from '../../../platform/database/tenant-context.js';
import { DeclarationsService, parseControlMonth, EDefterService, defaultBeratMonth } from '../../tax-filing/index.js';
import { NotificationsService } from './notifications.service.js';

const fmt = (d: Date) => d.toLocaleDateString('tr-TR');

/** İki tarih arasındaki takvim günü farkı (saatler yok sayılır): 25 Ekim 09:00 → 28 Ekim 23:59 = 3. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Her sabah çalışan hatırlatıcılar. Her bildirim bir dedupeKey taşır; iş tekrar çalışsa da
 * aynı olay için ikinci bildirim üretilmez.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly declarations: DeclarationsService,
    private readonly notifications: NotificationsService,
    private readonly edefter: EDefterService,
  ) {}

  async runAll(now = new Date()) {
    const tenants = await runAsSystem(() => this.prisma.tenant.findMany({ select: { id: true } }));
    let created = 0;
    // Her büro kendi RLS bağlamında: bir büronun hatırlatıcısı başka büronun verisini göremez
    for (const t of tenants) created += await runAsTenant(t.id, () => this.runForTenant(t.id, now));
    this.logger.log(`Günlük hatırlatıcılar: ${tenants.length} büro, ${created} yeni bildirim`);
    return { tenants: tenants.length, created };
  }

  async runForTenant(tenantId: string, now = new Date()) {
    let created = 0;
    const add = async (...args: Parameters<NotificationsService['notify']>) => {
      if (await this.notifications.notify(...args)) created++;
    };

    // 1) Beyanname: son günü 3 gün içinde olan ve verilmemişler; son günü geçmiş olanlar
    const { year, month } = parseControlMonth(undefined, now);
    const control = await this.declarations.control(tenantId, year, month, now);
    for (const t of control.types) {
      const due = new Date(t.dueDate);
      const daysLeft = calendarDaysBetween(now, due);
      if (t.counts.PENDING > 0 && daysLeft >= 0 && daysLeft <= 3) {
        await add(tenantId, {
          category: 'BEYANNAME_SON_GUN',
          title: `${t.short} (${t.periodLabel}) son gün ${fmt(due)}`,
          body: `${t.counts.PENDING} firma için henüz verilmedi${daysLeft === 0 ? ' — son gün bugün' : ` — ${daysLeft} gün kaldı`}.`,
          link: `/beyanname?month=${year}-${String(month).padStart(2, '0')}`,
          dedupeKey: `beyanname:son-gun:${t.type}:${t.period}:${daysLeft === 0 ? 'bugun' : '3gun'}`,
        });
      }
      if (t.counts.LATE > 0) {
        await add(tenantId, {
          category: 'BEYANNAME_GECIKTI',
          title: `${t.short} (${t.periodLabel}) süresi geçti`,
          body: `${t.counts.LATE} firma için son gün (${fmt(due)}) geçti, beyanname görünmüyor.`,
          link: `/beyanname?month=${year}-${String(month).padStart(2, '0')}`,
          dedupeKey: `beyanname:gecikti:${t.type}:${t.period}`,
        });
      }
    }

    // 2) e-Defter beratları: son günü bu aya denk gelen dönem (elle düzeltilmiş son günler dahil)
    const bm = defaultBeratMonth(now);
    const berat = await this.edefter.control(tenantId, bm.year, bm.month, now);
    const byDue = new Map<string, { due: Date; pending: number; late: number; label: string; period: string }>();
    for (const r of berat.rows) {
      if (!r.dueDate || (r.status !== 'PENDING' && r.status !== 'LATE')) continue;
      const key = `${r.period}|${r.dueDate.toISOString()}`;
      const g = byDue.get(key) ?? { due: r.dueDate, pending: 0, late: 0, label: r.periodLabel, period: r.period };
      if (r.status === 'PENDING') g.pending++;
      else g.late++;
      byDue.set(key, g);
    }
    const bmLink = `/edefter?month=${bm.year}-${String(bm.month).padStart(2, '0')}`;
    for (const g of byDue.values()) {
      const daysLeft = calendarDaysBetween(now, g.due);
      if (g.pending > 0 && daysLeft >= 0 && daysLeft <= 3) {
        await add(tenantId, {
          category: 'EDEFTER',
          title: `e-Defter berat (${g.label}) son gün ${fmt(g.due)}`,
          body: `${g.pending} firmanın beratı yüklenmedi${daysLeft === 0 ? ' — son gün bugün' : ` — ${daysLeft} gün kaldı`}.`,
          link: bmLink,
          dedupeKey: `edefter:son-gun:${g.period}:${g.due.toISOString().slice(0, 10)}:${daysLeft === 0 ? 'bugun' : '3gun'}`,
        });
      }
      if (g.late > 0) {
        await add(tenantId, {
          category: 'EDEFTER',
          title: `e-Defter berat (${g.label}) süresi geçti`,
          body: `${g.late} firmanın beratı son günde (${fmt(g.due)}) yüklenmiş görünmüyor.`,
          link: bmLink,
          dedupeKey: `edefter:gecikti:${g.period}:${g.due.toISOString().slice(0, 10)}`,
        });
      }
    }

    // 3) e-Tebligat: incelenmemiş ve tebliğ sayılma tarihi 2 gün içinde olanlar (tebligat başına bir kez)
    const soon = await this.prisma.eTebligat.findMany({
      where: {
        company: { tenantId },
        reviewedAt: null,
        // Bugün dahil önümüzdeki 2 takvim günü içinde tebliğ sayılacaklar
        deemedServedAt: { gte: now, lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 23, 59, 59) },
      },
      select: { id: true, subject: true, deemedServedAt: true, company: { select: { title: true } } },
    });
    for (const tb of soon) {
      await add(tenantId, {
        category: 'TEBLIGAT',
        title: `Tebliğ tarihi yaklaşıyor: ${tb.company.title}`,
        body: `${tb.subject ?? 'e-Tebligat'} — ${fmt(tb.deemedServedAt)} günü sonunda tebliğ edilmiş sayılacak; süreler o tarihten başlar.`,
        link: '/tebligat',
        dedupeKey: `tebligat:yaklasiyor:${tb.id}`,
      });
    }
    return created;
  }
}
