import { PLANS, extendExpiry } from '../core-rules.js';

// Büro (müşavir hesabı) için satış kuralları. Saf: tarih dışarıdan verilir.

export type OfficeStatus = 'aktif' | 'deneme' | 'suresi-doldu' | 'donduruldu';

export const OFFICE_STATUS_LABEL: Record<OfficeStatus, string> = {
  aktif: 'Aktif',
  deneme: 'Deneme',
  'suresi-doldu': 'Süresi doldu',
  donduruldu: 'Donduruldu',
};

export const DEFAULT_TRIAL_DAYS = 14;
export const MAX_TRIAL_DAYS = 90;

/**
 * Dondurma her şeyin önündedir; sonra lisans süresi. Lisans deneme bitişinden ileri uzatılmadıysa
 * (ödeme ya da satışın uzatması yoksa) büro denemededir.
 */
export function officeStatus(
  o: { suspendedAt: Date | null; expiresAt: Date | null; trialEndsAt: Date | null },
  now = new Date(),
): OfficeStatus {
  if (o.suspendedAt) return 'donduruldu';
  if (!o.expiresAt || o.expiresAt <= now) return 'suresi-doldu';
  if (o.trialEndsAt && o.expiresAt <= o.trialEndsAt) return 'deneme';
  return 'aktif';
}

const DAY_MS = 86_400_000;

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

/** Lisansı uzatır: süre bitmemişse bitişin üzerine, bittiyse bugünden itibaren (ödeme kuralıyla aynı). */
export function extendLicense(current: Date | null, by: { months?: number; days?: number }, now = new Date()): Date {
  if (by.months) return extendExpiry(current, by.months, now);
  const base = current && current > now ? current : now;
  return addDays(base, by.days ?? 0);
}

/** Satışın seçebileceği paket; bilinmeyen anahtar null. */
export const findPlan = (key: string) => PLANS.find((p) => p.key === key) ?? null;

/**
 * Türkiye cep / sabit telefonunu E.164 (başında + olmadan) biçimine çevirir: "0532 123 45 67",
 * "+90 (532) 123-45-67", "5321234567" → "905321234567". Geçersizse null.
 */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s()+\-.]/g, '');
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith('0090')) d = d.slice(2);
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return /^90[2-5]\d{9}$/.test(d) ? d : null;
}

/** Ekranda gösterim: "905321234567" → "+90 532 123 45 67" */
export function formatPhone(e164: string | null): string {
  if (!e164 || !/^90\d{10}$/.test(e164)) return e164 ?? '';
  return `+90 ${e164.slice(2, 5)} ${e164.slice(5, 8)} ${e164.slice(8, 10)} ${e164.slice(10)}`;
}
