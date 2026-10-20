import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword, PLANS, type Prisma } from '../core.js';
import {
  addDays,
  DEFAULT_TRIAL_DAYS,
  extendLicense,
  findPlan,
  officeStatus,
  normalizePhone,
  type OfficeStatus,
} from '../domain/office.js';
import { generateTempPassword } from '../domain/password.js';
import { PrismaService } from '../infrastructure/prisma.service.js';
import { SalesAuditService } from '../infrastructure/audit.service.js';

type Tx = Prisma.TransactionClient;

export interface CreateOffice {
  officeName: string;
  contactName: string;
  email: string;
  phone: string;
  plan?: string;
  trialDays?: number;
}

export interface UpdateOffice {
  officeName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/** Büro kullanıcısının satışa görünen alanları (şifre özeti, 2FA anahtarı, telefon izni vb. dönmez). */
const officeUserSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  totpEnabledAt: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
} as const;

/**
 * Satış ekibinin büro (müşavir hesabı) işlemleri. Yalnız büro hesabı bilgilerine erişir; mükellef ve diğer iş verisi
 * veritabanı yetkisiyle kapalıdır (yalnız aktif mükellef SAYISI okunur). Büroyu etkileyen her işlem iki zincire yazılır.
 */
@Injectable()
export class OfficesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: SalesAuditService,
  ) {}

  plans() {
    return PLANS.map(({ key, name, companyQuota }) => ({ key, name, companyQuota }));
  }

  private async companyCounts(tenantIds?: string[]) {
    const rows = tenantIds
      ? await this.prisma.$queryRaw<{ tenantId: string; n: number }[]>`
          SELECT "tenantId", count(*)::int AS n FROM "Company" WHERE "isActive" AND "tenantId" = ANY(${tenantIds}) GROUP BY "tenantId"`
      : await this.prisma.$queryRaw<{ tenantId: string; n: number }[]>`
          SELECT "tenantId", count(*)::int AS n FROM "Company" WHERE "isActive" GROUP BY "tenantId"`;
    return new Map(rows.map((r) => [r.tenantId, r.n]));
  }

  async list(q?: string, status?: OfficeStatus) {
    const term = q?.trim();
    const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });
    const tenants = await this.prisma.tenant.findMany({
      where: term
        ? {
            OR: [
              { name: contains(term) },
              { users: { some: { OR: [{ email: contains(term) }, { fullName: contains(term) }] } } },
              { salesAccount: { OR: [{ contactName: contains(term) }, { contactEmail: contains(term) }, { contactPhone: { contains: term.replace(/\D/g, '') || term } }] } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        createdAt: true,
        subscription: { select: { plan: true, expiresAt: true } },
        salesAccount: { select: { contactName: true, contactEmail: true, contactPhone: true, trialEndsAt: true, suspendedAt: true } },
        users: { where: { role: 'ADMIN' }, select: { fullName: true, email: true, phone: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const counts = await this.companyCounts(tenants.map((t) => t.id));
    const now = new Date();
    const rows = tenants.map((t) => {
      const admin = t.users[0];
      const acc = t.salesAccount;
      return {
        id: t.id,
        name: t.name,
        contactName: acc?.contactName ?? admin?.fullName ?? null,
        contactEmail: acc?.contactEmail ?? admin?.email ?? null,
        contactPhone: acc?.contactPhone ?? admin?.phone ?? null,
        plan: t.subscription?.plan ?? null,
        expiresAt: t.subscription?.expiresAt ?? null,
        companyCount: counts.get(t.id) ?? 0,
        status: officeStatus({ suspendedAt: acc?.suspendedAt ?? null, expiresAt: t.subscription?.expiresAt ?? null, trialEndsAt: acc?.trialEndsAt ?? null }, now),
        createdAt: t.createdAt,
      };
    });
    return status ? rows.filter((r) => r.status === status) : rows;
  }

  async create(dto: CreateOffice, salesUserId: string) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('Telefon numarası geçersiz (ör. 0532 123 45 67)');
    const plan = findPlan(dto.plan ?? 'baslangic');
    if (!plan) throw new BadRequestException('Paket bulunamadı');
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new BadRequestException('Bu e-posta ile kayıtlı bir müşavir kullanıcısı var');
    }
    const trialDays = dto.trialDays ?? DEFAULT_TRIAL_DAYS;
    const trialEndsAt = addDays(new Date(), trialDays);
    const officeName = dto.officeName.trim();
    const contactName = dto.contactName.trim();
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name: officeName,
          // Müşavir ilk girişte şifresini değiştirir ve iki adımlı doğrulamayı kurar
          require2fa: true,
          billingName: officeName,
          billingContactName: contactName,
          billingEmail: email,
          billingPhone: `+${phone}`,
        },
        select: { id: true },
      });
      await tx.subscription.create({ data: { tenantId: t.id, plan: plan.key, companyQuota: plan.companyQuota, expiresAt: trialEndsAt } });
      await tx.user.create({
        data: { tenantId: t.id, email, fullName: contactName, role: 'ADMIN', passwordHash, mustChangePassword: true, phone },
      });
      await tx.salesAccount.create({
        data: { tenantId: t.id, contactName, contactEmail: email, contactPhone: phone, createdById: salesUserId, trialEndsAt },
      });
      await this.audit.logOffice(tx, t.id, { salesUserId, action: 'sales.office.create', detail: { plan: plan.key, trialDays } });
      return t;
    });
    return { id: tenant.id, loginEmail: email, tempPassword, trialEndsAt };
  }

  private async findTenant(id: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        require2fa: true,
        subscription: { select: { plan: true, companyQuota: true, expiresAt: true } },
        salesAccount: true,
        users: { select: officeUserSelect, orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!t) throw new NotFoundException('Büro bulunamadı');
    return t;
  }

  async detail(id: string) {
    const t = await this.findTenant(id);
    const [counts, history] = await Promise.all([this.companyCounts([id]), this.history(id)]);
    const acc = t.salesAccount;
    const admin = t.users.find((u) => u.role === 'ADMIN');
    const now = new Date();
    return {
      id: t.id,
      name: t.name,
      createdAt: t.createdAt,
      require2fa: t.require2fa,
      contactName: acc?.contactName ?? admin?.fullName ?? null,
      contactEmail: acc?.contactEmail ?? admin?.email ?? null,
      contactPhone: acc?.contactPhone ?? null,
      plan: t.subscription?.plan ?? null,
      companyQuota: t.subscription?.companyQuota ?? null,
      expiresAt: t.subscription?.expiresAt ?? null,
      trialEndsAt: acc?.trialEndsAt ?? null,
      suspendedAt: acc?.suspendedAt ?? null,
      companyCount: counts.get(id) ?? 0,
      status: officeStatus({ suspendedAt: acc?.suspendedAt ?? null, expiresAt: t.subscription?.expiresAt ?? null, trialEndsAt: acc?.trialEndsAt ?? null }, now),
      users: t.users.map(({ totpEnabledAt, lockedUntil, ...u }) => ({ ...u, twoFactorEnabled: !!totpEnabledAt, locked: !!lockedUntil && lockedUntil > now })),
      history,
    };
  }

  /** Büro için satış işlemleri (en yeni 50). */
  async history(tenantId: string) {
    const rows = await this.prisma.salesAuditLog.findMany({
      where: { target: tenantId },
      orderBy: { seq: 'desc' },
      take: 50,
      select: { id: true, action: true, detail: true, createdAt: true, salesUserId: true },
    });
    const ids = [...new Set(rows.map((r) => r.salesUserId).filter((x): x is string => !!x))];
    const names = new Map(
      (await this.prisma.salesUser.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })).map((u) => [u.id, u.fullName]),
    );
    return rows.map(({ salesUserId, ...r }) => ({ ...r, by: salesUserId ? (names.get(salesUserId) ?? null) : null }));
  }

  /** Satış dışında açılmış (ör. demo) büroda satış kaydı yoksa yöneticiden oluşturur. */
  private async ensureAccount(tx: Tx, tenantId: string) {
    const acc = await tx.salesAccount.findUnique({ where: { tenantId } });
    if (acc) return acc;
    const admin = await tx.user.findFirst({ where: { tenantId, role: 'ADMIN' }, orderBy: { createdAt: 'asc' }, select: { fullName: true, email: true, phone: true } });
    if (!admin) throw new BadRequestException('Büroda yönetici kullanıcı yok');
    return tx.salesAccount.create({ data: { tenantId, contactName: admin.fullName, contactEmail: admin.email, contactPhone: admin.phone } });
  }

  async update(id: string, dto: UpdateOffice, salesUserId: string) {
    await this.findTenant(id);
    const contactPhone = dto.contactPhone === undefined ? undefined : normalizePhone(dto.contactPhone);
    if (contactPhone === null) throw new BadRequestException('Telefon numarası geçersiz (ör. 0532 123 45 67)');
    await this.prisma.$transaction(async (tx) => {
      if (dto.officeName) await tx.tenant.update({ where: { id }, data: { name: dto.officeName.trim() } });
      await this.ensureAccount(tx, id);
      await tx.salesAccount.update({
        where: { tenantId: id },
        data: {
          ...(dto.contactName ? { contactName: dto.contactName.trim() } : {}),
          ...(dto.contactEmail ? { contactEmail: dto.contactEmail.trim().toLowerCase() } : {}),
          ...(contactPhone ? { contactPhone } : {}),
        },
      });
      // Değişen alanların adı yazılır, değerleri (kişisel veri) yazılmaz
      await this.audit.logOffice(tx, id, { salesUserId, action: 'sales.office.update', detail: { fields: Object.keys(dto) } });
    });
    return this.detail(id);
  }

  async extend(id: string, by: { months?: number; days?: number; plan?: string }, salesUserId: string) {
    if (!by.months && !by.days) throw new BadRequestException('Ay ya da gün belirtin');
    const plan = by.plan ? findPlan(by.plan) : null;
    if (by.plan && !plan) throw new BadRequestException('Paket bulunamadı');
    const t = await this.findTenant(id);
    const current = t.subscription?.expiresAt ?? null;
    const expiresAt = extendLicense(current, by);
    await this.prisma.$transaction(async (tx) => {
      const p = plan ?? findPlan(t.subscription?.plan ?? '') ?? PLANS[0];
      await tx.subscription.upsert({
        where: { tenantId: id },
        create: { tenantId: id, plan: p.key, companyQuota: p.companyQuota, expiresAt },
        update: { expiresAt, ...(plan ? { plan: plan.key, companyQuota: plan.companyQuota } : {}) },
      });
      await this.audit.logOffice(tx, id, {
        salesUserId,
        action: 'sales.office.extend',
        detail: { months: by.months ?? null, days: by.days ?? null, plan: plan?.key ?? null, from: current?.toISOString() ?? null, to: expiresAt.toISOString() },
      });
    });
    return this.detail(id);
  }

  /** Büroyu dondurur: aktif kullanıcıları kapatılır, açık oturumları düşer. Açılınca yalnız bunlar geri açılır. */
  async suspend(id: string, reason: string | undefined, salesUserId: string) {
    await this.findTenant(id);
    await this.prisma.$transaction(async (tx) => {
      const acc = await this.ensureAccount(tx, id);
      if (acc.suspendedAt) throw new BadRequestException('Büro zaten dondurulmuş');
      const active = await tx.user.findMany({ where: { tenantId: id, isActive: true }, select: { id: true } });
      const ids = active.map((u) => u.id);
      await tx.user.updateMany({ where: { id: { in: ids } }, data: { isActive: false, sessionVersion: { increment: 1 } } });
      await tx.salesAccount.update({ where: { tenantId: id }, data: { suspendedAt: new Date(), suspendedUserIds: ids } });
      await this.audit.logOffice(tx, id, { salesUserId, action: 'sales.office.suspend', detail: { users: ids.length, reason: reason?.trim() || null } });
    });
    return this.detail(id);
  }

  async resume(id: string, salesUserId: string) {
    await this.findTenant(id);
    await this.prisma.$transaction(async (tx) => {
      const acc = await this.ensureAccount(tx, id);
      if (!acc.suspendedAt) throw new BadRequestException('Büro dondurulmuş değil');
      const { count } = await tx.user.updateMany({
        where: { tenantId: id, id: { in: acc.suspendedUserIds } },
        data: { isActive: true, failedLogins: 0, lockedUntil: null },
      });
      await tx.salesAccount.update({ where: { tenantId: id }, data: { suspendedAt: null, suspendedUserIds: [] } });
      await this.audit.logOffice(tx, id, { salesUserId, action: 'sales.office.resume', detail: { users: count } });
    });
    return this.detail(id);
  }

  private async officeUser(tenantId: string, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
    if (!u) throw new NotFoundException('Kullanıcı bu büroda bulunamadı');
  }

  /** Müşavirin şifresini sıfırlar: geçici şifre yanıtta bir kez gösterilir, ilk girişte değiştirilir. */
  async resetPassword(tenantId: string, userId: string, salesUserId: string) {
    await this.officeUser(tenantId, userId);
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 }, failedLogins: 0, lockedUntil: null },
      });
      await this.audit.logOffice(tx, tenantId, { salesUserId, action: 'sales.office.user.password-reset', detail: { userId } });
    });
    return { tempPassword };
  }

  /** Telefonunu kaybeden müşavir: iki adımlı doğrulama kaldırılır; büro zorunlu tuttuğundan girişte yeniden kurar. */
  async resetTwoFactor(tenantId: string, userId: string, salesUserId: string) {
    await this.officeUser(tenantId, userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [], sessionVersion: { increment: 1 } },
      });
      await this.audit.logOffice(tx, tenantId, { salesUserId, action: 'sales.office.user.2fa-reset', detail: { userId } });
    });
    return { ok: true };
  }
}
