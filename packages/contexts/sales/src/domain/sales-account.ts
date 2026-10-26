import { validEmail } from './sales-user.ts';

// Ofis satış hesabı (SalesAccount): ofisin satış tarafındaki kaydı — yetkili, paket, deneme ve lisans bitişi (D40).
// Lisans bu aşamada yalnız kayıttır: portala girişi engellemez (dondurma engeller). Saf: zaman parametreyle gelir.

export type Plan = { readonly key: string; readonly name: string; readonly companyQuota: number };

/** Paketler (eski satış modülünden). Fiyat ve ödeme bu bağlamda yok; ödeme ekranları ayrı iştir. */
export const PLANS: readonly Plan[] = [
  { key: 'baslangic', name: 'Başlangıç', companyQuota: 50 },
  { key: 'pro', name: 'Pro', companyQuota: 150 },
  { key: 'kurumsal', name: 'Kurumsal', companyQuota: 500 },
];

export const findPlan = (key: string): Plan | null => PLANS.find((p) => p.key === key) ?? null;

export const DEFAULT_TRIAL_DAYS = 14;
export const MAX_TRIAL_DAYS = 90;

export const ACCOUNT_STATUSES = ['deneme', 'aktif', 'suresi_doldu', 'donduruldu', 'suresiz'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

const DAY_MS = 86_400_000;

export const trialEnd = (now: Date, days: number) => new Date(now.getTime() + days * DAY_MS);

/**
 * Dondurma her şeyin önündedir; sonra lisans süresi. Lisans deneme bitişinden ileri uzatılmadıysa ofis denemededir.
 * Lisans kaydı olmayan ofis (hesap açma komutuyla açılmış, demo) süresizdir.
 */
export function accountStatus(a: { frozen: boolean; expiresAt: Date | null; trialEndsAt: Date | null }, now: Date): AccountStatus {
  if (a.frozen) return 'donduruldu';
  if (!a.expiresAt) return 'suresiz';
  if (a.expiresAt <= now) return 'suresi_doldu';
  if (a.trialEndsAt && a.expiresAt <= a.trialEndsAt) return 'deneme';
  return 'aktif';
}

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

export type NewOfficeInput = { officeName: string; contactName: string; email: string; phone: string; plan: string; trialDays: string };
export type NewOffice = { officeName: string; contactName: string; email: string; phone: string; plan: string; trialDays: number };
export type NewOfficeField = keyof NewOfficeInput;

export function validateNewOffice(i: NewOfficeInput): { ok: true; value: NewOffice } | { ok: false; errors: { field: NewOfficeField; message: string }[] } {
  const officeName = (i.officeName ?? '').trim();
  const contactName = (i.contactName ?? '').trim();
  const email = (i.email ?? '').trim().toLowerCase();
  const phone = normalizePhone(i.phone ?? '');
  const gunMetni = (i.trialDays ?? '').trim();
  const trialDays = gunMetni === '' ? DEFAULT_TRIAL_DAYS : /^\d{1,3}$/.test(gunMetni) ? Number(gunMetni) : NaN;
  const errors: { field: NewOfficeField; message: string }[] = [];
  if (!officeName || officeName.length > 200) errors.push({ field: 'officeName', message: 'Ofis adı 1–200 karakter olmalı.' });
  if (!contactName || contactName.length > 200) errors.push({ field: 'contactName', message: 'Müşavirin adı soyadı 1–200 karakter olmalı.' });
  if (!validEmail(email)) errors.push({ field: 'email', message: 'Geçerli bir e-posta adresi girin.' });
  if (!phone) errors.push({ field: 'phone', message: 'Geçerli bir Türkiye telefon numarası girin.' });
  if (!findPlan(i.plan ?? '')) errors.push({ field: 'plan', message: 'Bir paket seçin.' });
  if (!(trialDays >= 1 && trialDays <= MAX_TRIAL_DAYS)) errors.push({ field: 'trialDays', message: `Deneme süresi 1–${MAX_TRIAL_DAYS} gün olmalı.` });
  if (errors.length || !phone) return { ok: false, errors };
  return { ok: true, value: { officeName, contactName, email, phone, plan: i.plan, trialDays } };
}
