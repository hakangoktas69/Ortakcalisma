import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { DeclarationsService } from '../declarations/declarations.service.js';
import { parseControlMonth } from '../declarations/declaration-rules.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { TebligatService } from '../tebligat/tebligat.service.js';
import { EBildirgeService } from '../sgk/ebildirge/ebildirge.service.js';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly declarations: DeclarationsService,
    private readonly notificationsService: NotificationsService,
    private readonly tebligat: TebligatService,
    private readonly ebildirge: EBildirgeService,
  ) {}

  @Get('summary')
  async summary(@CurrentUser() user: AuthUser) {
    const tenantId = user.tenantId;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Pazartesi
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const sgkWhere = { company: { tenantId } };
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const [byType, byActive, sub, calendar, notifications, sgkCompanies, workplaces, branches, reports, employment] = await Promise.all([
      this.prisma.company.groupBy({ by: ['type'], where: { tenantId }, _count: true }),
      this.prisma.company.groupBy({ by: ['isActive'], where: { tenantId }, _count: true }),
      this.prisma.subscription.findUnique({ where: { tenantId } }),
      this.prisma.taxCalendarEvent.findMany({
        where: { dueDate: { gte: weekStart, lt: weekEnd } },
        orderBy: { dueDate: 'asc' },
      }),
      this.notificationsService.list(tenantId, user.sub, { take: 6 }),
      this.prisma.company.count({ where: { tenantId, sgkWorkplaces: { some: {} } } }),
      this.prisma.sgkWorkplace.count({ where: sgkWhere }),
      this.prisma.sgkWorkplace.count({ where: { ...sgkWhere, isBranch: true } }),
      this.prisma.sgkReport.groupBy({ by: ['status'], where: { workplace: sgkWhere }, _count: true }),
      this.prisma.employmentEvent.groupBy({
        by: ['type'],
        where: { workplace: sgkWhere, eventDate: { gte: yearStart } },
        _count: true,
      }),
    ]);
    // e-Beyanname: varsayılan kontrol ayı (bir önceki ay)
    const { year: cy, month: cm } = parseControlMonth(undefined, now);
    const control = await this.declarations.control(tenantId, cy, cm, now);
    const cells = control.rows.flatMap((r) => r.cells);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const eBeyanname = {
      month: `${cy}-${String(cm).padStart(2, '0')}`,
      periodLabel: control.periodLabel,
      companiesFiled: control.rows.filter((r) => r.cells.some((c) => c.declaration)).length,
      typesFiled: new Set(cells.filter((c) => c.declaration).map((c) => c.type)).size,
      newLast7Days: cells.filter((c) => c.declaration && new Date(c.declaration.filedAt) >= weekAgo).length,
      filed: cells.filter((c) => c.status === 'FILED' || c.status === 'FILED_LATE').length,
      pending: cells.filter((c) => c.status === 'PENDING').length,
      late: cells.filter((c) => c.status === 'LATE').length,
      types: control.types.map((t) => ({ type: t.type, short: t.short, dueDate: t.dueDate, counts: t.counts })),
    };
    const reportCount = (s: string) => reports.find((r) => r.status === s)?._count ?? 0;

    const typeCount = (t: string) => byType.find((x) => x.type === t)?._count ?? 0;
    const activeCount = (a: boolean) => byActive.find((x) => x.isActive === a)?._count ?? 0;
    const total = byType.reduce((s, x) => s + x._count, 0);

    return {
      companies: {
        total,
        sirket: typeCount('SIRKET'),
        sahis: typeCount('SAHIS'),
        basitUsul: typeCount('BASIT_USUL'),
        aktif: activeCount(true),
        pasif: activeCount(false),
      },
      license: sub && {
        daysLeft: Math.max(0, Math.ceil((sub.expiresAt.getTime() - now.getTime()) / 86_400_000)),
        quotaUsed: total,
        quota: sub.companyQuota,
      },
      sgk: {
        companies: sgkCompanies,
        workplaces,
        branches,
        reportsPending: reportCount('PENDING'),
        reportsApproved: reportCount('APPROVED'),
        entriesThisYear: employment.find((e) => e.type === 'ENTRY')?._count ?? 0,
        exitsThisYear: employment.find((e) => e.type === 'EXIT')?._count ?? 0,
        ebildirge: await this.ebildirge.summary(tenantId),
      },
      eBeyanname,
      week: { start: weekStart, end: weekEnd, events: calendar },
      eTebligat: await this.tebligat.summary(tenantId, now),
      notifications: notifications.items,
      unreadCount: notifications.unread,
    };
  }
}
