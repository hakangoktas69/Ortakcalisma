import { roundKurus } from './iyzico.client.js';

// Lisans paketleri. FİYATLAR ÖRNEKTİR: gerçek fiyatlandırma netleşince burada güncellenir.
// Tutar her zaman bu tablodan sunucuda hesaplanır; istemciden gelen tutar kullanılmaz.

export interface Plan {
  key: string;
  name: string;
  companyQuota: number;
  monthlyPrice: number; // TL, KDV dahil
}

export const PLANS: Plan[] = [
  { key: 'baslangic', name: 'Başlangıç', companyQuota: 50, monthlyPrice: 750 },
  { key: 'pro', name: 'Pro', companyQuota: 150, monthlyPrice: 1500 },
  { key: 'kurumsal', name: 'Kurumsal', companyQuota: 500, monthlyPrice: 3500 },
];

/** Uzun dönem indirimi: 6 ay %5, 12 ay %15 */
export const PERIODS: { months: number; discount: number }[] = [
  { months: 1, discount: 0 },
  { months: 6, discount: 0.05 },
  { months: 12, discount: 0.15 },
];

export function priceFor(planKey: string, months: number): { plan: Plan; amount: number } | null {
  const plan = PLANS.find((p) => p.key === planKey);
  const period = PERIODS.find((p) => p.months === months);
  if (!plan || !period) return null;
  // Kuruş hassasiyetinde yuvarla
  const amount = roundKurus(plan.monthlyPrice * months * (1 - period.discount));
  return { plan, amount };
}

/** Lisans bitmemişse süre bitişin üzerine, bittiyse bugünden itibaren eklenir. */
export function extendExpiry(current: Date | null, months: number, now = new Date()): Date {
  const base = current && current > now ? new Date(current) : new Date(now);
  const day = base.getDate();
  base.setMonth(base.getMonth() + months);
  // 31 Ocak + 1 ay → 3 Mart olmasın; ayın son gününe sabitle
  if (base.getDate() < day) base.setDate(0);
  return base;
}
