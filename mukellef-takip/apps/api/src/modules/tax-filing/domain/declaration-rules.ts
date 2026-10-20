import type { CompanyType, DeclarationType } from '../../../generated/prisma/enums.js';

// Beyanname kuralları: dönemler ve yasal son günler.
//
// DİKKAT: Son günler genel kurallara göre hesaplanır (hafta sonuna denk gelirse ilk iş gününe kayar).
// Resmi tatiller, GİB'in ilan ettiği süre uzatımları ve mücbir sebep halleri burada YOKTUR.
// Kesin tarihler için GİB vergi takvimi esas alınmalı; ileride bu tablo vergi takviminden beslenecek.

export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export const DECLARATION_INFO: Record<DeclarationType, { label: string; short: string; frequency: Frequency }> = {
  KDV1: { label: 'KDV Beyannamesi', short: 'KDV', frequency: 'MONTHLY' },
  MUHSGK: { label: 'Muhtasar ve Prim Hizmet Beyannamesi', short: 'MUHSGK', frequency: 'MONTHLY' },
  DAMGA: { label: 'Damga Vergisi Beyannamesi', short: 'Damga', frequency: 'MONTHLY' },
  GECICI_VERGI: { label: 'Geçici Vergi Beyannamesi', short: 'Geçici', frequency: 'QUARTERLY' },
  YILLIK_GELIR: { label: 'Yıllık Gelir Vergisi Beyannamesi', short: 'Yıllık Gelir', frequency: 'YEARLY' },
  KURUMLAR: { label: 'Kurumlar Vergisi Beyannamesi', short: 'Kurumlar', frequency: 'YEARLY' },
};

export const DECLARATION_ORDER: DeclarationType[] = ['KDV1', 'MUHSGK', 'DAMGA', 'GECICI_VERGI', 'YILLIK_GELIR', 'KURUMLAR'];

/**
 * Firma türüne göre varsayılan yükümlülükler. Her firma için ekrandan düzenlenebilir;
 * örneğin işçi çalıştırmayan bir firmada MUHSGK kapatılır.
 * Basit usul: KDV mükellefi değildir; kazancı istisna kapsamındaysa yıllık beyan gerekmeyebilir.
 */
export const DEFAULT_OBLIGATIONS: Record<CompanyType, DeclarationType[]> = {
  SIRKET: ['KDV1', 'MUHSGK', 'DAMGA', 'GECICI_VERGI', 'KURUMLAR'],
  SAHIS: ['KDV1', 'MUHSGK', 'GECICI_VERGI', 'YILLIK_GELIR'],
  BASIT_USUL: ['MUHSGK'],
};

/** Hafta sonuna denk gelen son günü ilk iş gününe kaydırır; gün sonunu (23:59:59) döner. */
function deadline(year: number, monthIndex: number, day: number): Date {
  const d = new Date(year, monthIndex, day, 23, 59, 59);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

export interface ExpectedDeclaration {
  type: DeclarationType;
  period: string;
  dueDate: Date;
}

/**
 * Bir "kontrol ayı" (ör. 2026-09 = Eylül 2026 dönemi) için beklenen beyannameler.
 * - Aylık beyannameler o ayın dönemi.
 * - Geçici vergi: Mart/Haziran/Eylül aylarında ilgili çeyrek (4. dönem geçici vergi yoktur).
 * - Yıllık beyannameler: Aralık ayında o yılın beyanı.
 */
export function expectedForMonth(year: number, month: number): ExpectedDeclaration[] {
  const m = month - 1; // JS ay indeksi
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const out: ExpectedDeclaration[] = [
    { type: 'KDV1', period: ym, dueDate: deadline(year, m + 1, 28) },
    { type: 'MUHSGK', period: ym, dueDate: deadline(year, m + 1, 26) },
    { type: 'DAMGA', period: ym, dueDate: deadline(year, m + 1, 26) },
  ];
  if (month === 3 || month === 6 || month === 9) {
    // Çeyreği izleyen ikinci ayın 17'si
    out.push({ type: 'GECICI_VERGI', period: `${year}-Q${month / 3}`, dueDate: deadline(year, m + 2, 17) });
  }
  if (month === 12) {
    out.push({ type: 'YILLIK_GELIR', period: String(year), dueDate: deadline(year + 1, 2, 31) });
    out.push({ type: 'KURUMLAR', period: String(year), dueDate: deadline(year + 1, 3, 30) });
  }
  return out;
}

export function parseControlMonth(value: string | undefined, now = new Date()): { year: number; month: number } {
  const m = value && /^(\d{4})-(\d{2})$/.exec(value);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { year: Number(m[1]), month: Number(m[2]) };
  // Varsayılan: bir önceki ay (bu ay verilecek beyannamelerin dönemi)
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
}

export type ControlStatus = 'FILED' | 'FILED_LATE' | 'PENDING' | 'LATE';

export function statusOf(dueDate: Date, filedAt: Date | null | undefined, now = new Date()): ControlStatus {
  if (filedAt) return filedAt > dueDate ? 'FILED_LATE' : 'FILED';
  return now > dueDate ? 'LATE' : 'PENDING';
}

/** Dönem kodunu insan okunur hale getirir: "2026-09" → "Eylül 2026", "2026-Q3" → "2026 / 3. dönem". */
export function periodLabel(period: string): string {
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  let m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return `${months[Number(m[2]) - 1]} ${m[1]}`;
  m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (m) return `${m[1]} / ${m[2]}. dönem`;
  return period;
}
