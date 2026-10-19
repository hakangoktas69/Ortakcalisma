import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PERIODS, PLANS, extendExpiry, priceFor } from './plans.js';
import { IyzicoClient, IyzicoError, iyzicoPrice, verdictFromRetrieve } from './iyzico.client.js';

export interface BillingProfile {
  billingName: string;
  billingContactName: string;
  billingTaxNumber: string;
  billingTaxOffice?: string | null;
  billingAddress: string;
  billingCity: string;
  billingEmail: string;
  billingPhone: string;
}

const PROFILE_FIELDS = [
  'billingName',
  'billingContactName',
  'billingTaxNumber',
  'billingTaxOffice',
  'billingAddress',
  'billingCity',
  'billingEmail',
  'billingPhone',
] as const;
const REQUIRED_PROFILE_FIELDS = PROFILE_FIELDS.filter((f) => f !== 'billingTaxOffice');
type ProfileRecord = Partial<Record<(typeof PROFILE_FIELDS)[number], string | null>>;

/** "Ayşe Nur Yılmaz" → { name: "Ayşe Nur", surname: "Yılmaz" } (iyzico alıcı adı / soyadı ayrı ister) */
export function splitContactName(full: string): { name: string; surname: string } {
  const parts = full.trim().split(/\s+/);
  const surname = parts.pop() ?? '';
  return { name: parts.join(' '), surname };
}

/**
 * Ödeme sağlayıcısı (BILLING_PROVIDER):
 *  - demo: gerçek para çekilmez, ödeme butonla onaylanır.
 *  - iyzico: Ödeme Formu. Kart bilgileri iyzico'nun sayfasında girilir. Kullanıcı geri döndüğünde
 *    tarayıcıdan gelen bilgiye güvenilmez; sunucu iyzico'ya token ile SORAR ve verdictFromRetrieve
 *    (başarı + dolandırıcılık onayı + tutar + sepet no) tutarsa lisans uzatılır.
 */
@Injectable()
export class BillingService {
  readonly provider: 'demo' | 'iyzico' = process.env.BILLING_PROVIDER === 'iyzico' ? 'iyzico' : 'demo';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly iyzico: IyzicoClient,
  ) {}

  async overview(tenantId: string) {
    const [sub, used, payments, profile] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { tenantId } }),
      this.prisma.company.count({ where: { tenantId } }),
      this.prisma.payment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, plan: true, months: true, amount: true, currency: true, status: true, provider: true, createdAt: true, paidAt: true, error: true, fraudStatus: true },
      }),
      this.profile(tenantId),
    ]);
    return {
      provider: this.provider,
      sandbox: this.provider === 'iyzico' ? this.iyzico.isSandbox : null,
      providerConfigured: this.provider === 'demo' || this.iyzico.configured,
      profileComplete: profile.complete,
      subscription: sub && {
        plan: sub.plan,
        planName: PLANS.find((p) => p.key === sub.plan)?.name ?? sub.plan,
        companyQuota: sub.companyQuota,
        expiresAt: sub.expiresAt,
        daysLeft: Math.max(0, Math.ceil((sub.expiresAt.getTime() - Date.now()) / 86_400_000)),
        used,
      },
      plans: PLANS.map((p) => ({
        ...p,
        prices: PERIODS.map((x) => ({ months: x.months, discount: x.discount, amount: priceFor(p.key, x.months)!.amount })),
        fitsCurrent: used <= p.companyQuota,
      })),
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    };
  }

  private missingProfileFields(t: ProfileRecord) {
    return REQUIRED_PROFILE_FIELDS.filter((f) => !t[f]?.trim());
  }

  async profile(tenantId: string) {
    const t = (await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, true])),
    })) as ProfileRecord;
    return { ...t, complete: this.missingProfileFields(t).length === 0 };
  }

  async updateProfile(tenantId: string, userId: string, p: BillingProfile) {
    const taxNumber = p.billingTaxNumber.replace(/\D/g, '');
    if (taxNumber.length !== 10 && taxNumber.length !== 11) throw new BadRequestException('VKN 10, TCKN 11 haneli olmalı');
    let phone = p.billingPhone.replace(/\D/g, '');
    if (phone.length === 10 && phone.startsWith('5')) phone = '90' + phone;
    if (phone.length === 11 && phone.startsWith('05')) phone = '9' + phone;
    if (!/^905\d{9}$/.test(phone)) throw new BadRequestException('Cep telefonu 05xx xxx xx xx biçiminde olmalı');
    const { name, surname } = splitContactName(p.billingContactName);
    if (!name || !surname) throw new BadRequestException('Yetkili kişinin adını ve soyadını yazın');
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        billingName: p.billingName.trim(),
        billingContactName: p.billingContactName.trim().replace(/\s+/g, ' '),
        billingTaxNumber: taxNumber,
        billingTaxOffice: p.billingTaxOffice?.trim() || null,
        billingAddress: p.billingAddress.trim(),
        billingCity: p.billingCity.trim(),
        billingEmail: p.billingEmail.trim().toLowerCase(),
        billingPhone: '+' + phone,
      },
    });
    await this.audit.log({ tenantId, userId, action: 'billing.profile.update' });
    return this.profile(tenantId);
  }

  /** Ödeme kaydı açar; tutar sunucuda hesaplanır. iyzico'da ödeme sayfasının adresini döner. */
  async checkout(tenantId: string, userId: string, planKey: string, months: number, clientIp?: string) {
    const priced = priceFor(planKey, months);
    if (!priced) throw new BadRequestException('Geçersiz paket veya süre');
    const used = await this.prisma.company.count({ where: { tenantId } });
    if (used > priced.plan.companyQuota) {
      throw new BadRequestException(`Bu paket ${priced.plan.companyQuota} firma içerir; portalda ${used} firma var. Önce pasif firmaları silin veya daha büyük paket seçin.`);
    }
    let tenant: Awaited<ReturnType<typeof this.prisma.tenant.findUniqueOrThrow>> | null = null;
    if (this.provider === 'iyzico') {
      if (!this.iyzico.configured) throw new BadRequestException('iyzico anahtarları tanımlı değil');
      tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
      if (this.missingProfileFields(tenant).length) throw new BadRequestException('Ödemeden önce fatura bilgilerini eksiksiz doldurun');
    }

    const payment = await this.prisma.payment.create({
      data: { tenantId, plan: planKey, months, amount: priced.amount, provider: this.provider, createdById: userId },
      select: { id: true, amount: true, plan: true, months: true, provider: true },
    });
    await this.audit.log({ tenantId, userId, action: 'billing.checkout', target: payment.id, detail: { plan: planKey, months, amount: priced.amount, provider: this.provider } });
    if (this.provider !== 'iyzico' || !tenant) return { ...payment, amount: Number(payment.amount), redirectUrl: null as string | null };

    const { name, surname } = splitContactName(tenant.billingContactName!);
    const price = iyzicoPrice(priced.amount);
    try {
      const { token, paymentPageUrl } = await this.iyzico.initialize({
        locale: 'tr',
        conversationId: payment.id,
        basketId: payment.id,
        price,
        paidPrice: price,
        currency: 'TRY',
        paymentGroup: 'PRODUCT',
        // Taksit kapalı: taksitte tahsil edilen tutar değişebilir ve tutar doğrulamasını bozar
        enabledInstallments: [1],
        callbackUrl: `${(process.env.API_PUBLIC_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '')}/billing/iyzico/callback`,
        buyer: {
          id: userId,
          name,
          surname,
          identityNumber: tenant.billingTaxNumber!,
          email: tenant.billingEmail!,
          gsmNumber: tenant.billingPhone!,
          registrationAddress: tenant.billingAddress!,
          city: tenant.billingCity!,
          country: 'Turkey',
          ...(clientIp ? { ip: clientIp } : {}),
        },
        billingAddress: { contactName: tenant.billingName!, city: tenant.billingCity!, country: 'Turkey', address: tenant.billingAddress! },
        basketItems: [
          { id: priced.plan.key, name: `Mükellef Takip ${priced.plan.name} lisansı (${months} ay)`, category1: 'Yazılım lisansı', itemType: 'VIRTUAL', price },
        ],
      });
      await this.prisma.payment.update({ where: { id: payment.id }, data: { providerToken: token } });
      return { ...payment, amount: Number(payment.amount), redirectUrl: paymentPageUrl };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', error: message.slice(0, 500) } });
      if (e instanceof IyzicoError) throw new BadRequestException(message);
      throw e;
    }
  }

  /**
   * iyzico geri dönüşü (ve "durumu yenile"): ödemeyi token ile iyzico'ya sorar ve sonucu uygular.
   * Tarayıcının gönderdiği token yalnızca hangi ödemeye bakılacağını bulmaya yarar; sonuç iyzico'dan alınır.
   */
  async settleIyzico(token: string): Promise<{ outcome: 'PAID' | 'REVIEW' | 'FAILED' | 'UNKNOWN'; paymentId?: string }> {
    const p = await this.prisma.payment.findUnique({ where: { providerToken: token } });
    if (!p || p.provider !== 'iyzico') return { outcome: 'UNKNOWN' };
    if (p.status === 'PAID') return { outcome: 'PAID', paymentId: p.id };
    if (p.status === 'FAILED') return { outcome: 'FAILED', paymentId: p.id };

    const r = await this.iyzico.retrieve(token, p.id);
    const v = verdictFromRetrieve(r, { paymentId: p.id, amount: Number(p.amount), currency: p.currency });
    if (v.outcome === 'PAID') {
      await this.prisma.payment.update({ where: { id: p.id }, data: { fraudStatus: v.fraudStatus } });
      await this.markPaid(p.tenantId, p.id, v.paymentId, null);
    } else if (v.outcome === 'REVIEW') {
      await this.prisma.payment.update({ where: { id: p.id }, data: { fraudStatus: v.fraudStatus, providerRef: v.paymentId ?? null, error: v.reason } });
    } else {
      await this.prisma.payment.updateMany({
        where: { id: p.id, status: 'PENDING' },
        data: { status: 'FAILED', error: v.reason.slice(0, 500), fraudStatus: v.fraudStatus ?? null },
      });
    }
    await this.audit.log({
      tenantId: p.tenantId,
      userId: null,
      action: 'billing.iyzico.settle',
      target: p.id,
      detail: { outcome: v.outcome, ...(v.outcome !== 'PAID' ? { reason: v.reason } : {}) },
    });
    return { outcome: v.outcome, paymentId: p.id };
  }

  /** Bekleyen (ör. incelemedeki) iyzico ödemesini yeniden sorgular. */
  async refresh(tenantId: string, paymentId: string) {
    const p = await this.prisma.payment.findFirst({ where: { id: paymentId, tenantId } });
    if (!p) throw new NotFoundException('Ödeme bulunamadı');
    if (p.provider !== 'iyzico' || !p.providerToken) throw new BadRequestException('Bu ödeme iyzico ödemesi değil');
    return this.settleIyzico(p.providerToken);
  }

  /** Demo sağlayıcı: ödemeyi başarılı sayar. Gerçek sağlayıcıda bu uç çalışmaz. */
  async demoConfirm(tenantId: string, userId: string, paymentId: string) {
    if (this.provider !== 'demo') throw new ForbiddenException('Demo onay sadece demo modunda kullanılabilir');
    const p = await this.prisma.payment.findFirst({ where: { id: paymentId, tenantId }, select: { provider: true } });
    if (p && p.provider !== 'demo') throw new ForbiddenException('Bu ödeme demo ödemesi değil');
    return this.markPaid(tenantId, paymentId, `demo-${Date.now()}`, userId);
  }

  /**
   * Ödemeyi onaylar ve lisansı uzatır. Aynı ödeme iki kez işlenmez: durum geçişi "yalnızca hâlâ PENDING ise"
   * koşuluyla yapılır, böylece eşzamanlı iki onay (geri dönüş + yenile) lisansı iki kez uzatamaz.
   */
  async markPaid(tenantId: string, paymentId: string, providerRef: string, userId: string | null) {
    const result = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
      if (!p) throw new NotFoundException('Ödeme bulunamadı');
      if (p.status === 'PAID') return { already: true as const };
      if (p.status !== 'PENDING') throw new BadRequestException('Ödeme bekleyen durumda değil');
      const { count } = await tx.payment.updateMany({
        where: { id: p.id, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date(), providerRef, error: null },
      });
      if (count === 0) return { already: true as const }; // başka bir istek az önce onayladı
      const plan = PLANS.find((x) => x.key === p.plan)!;
      const sub = await tx.subscription.findUnique({ where: { tenantId } });
      const expiresAt = extendExpiry(sub?.expiresAt ?? null, p.months);
      await tx.subscription.upsert({
        where: { tenantId },
        create: { tenantId, plan: plan.key, companyQuota: plan.companyQuota, expiresAt },
        update: { plan: plan.key, companyQuota: plan.companyQuota, expiresAt },
      });
      return { already: false as const, expiresAt, planName: plan.name };
    });
    if (result.already) {
      const p = await this.prisma.subscription.findUnique({ where: { tenantId }, select: { expiresAt: true } });
      return { ok: true, alreadyPaid: true, expiresAt: p?.expiresAt ?? null };
    }
    await this.audit.log({ tenantId, userId, action: 'billing.paid', target: paymentId, detail: { providerRef } });
    await this.notifications.notify(tenantId, {
      category: 'SISTEM',
      title: 'Lisans uzatıldı',
      body: `${result.planName} paketi, ${result.expiresAt.toLocaleDateString('tr-TR')} tarihine kadar geçerli.`,
      link: '/odeme',
    });
    return { ok: true, alreadyPaid: false, expiresAt: result.expiresAt };
  }

  async cancel(tenantId: string, paymentId: string) {
    const { count } = await this.prisma.payment.updateMany({ where: { id: paymentId, tenantId, status: 'PENDING' }, data: { status: 'FAILED', error: 'Kullanıcı vazgeçti' } });
    if (!count) throw new NotFoundException('Bekleyen ödeme bulunamadı');
  }
}
