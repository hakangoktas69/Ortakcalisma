import type { CompanyType, EDefterPreference } from '../generated/prisma/enums.js';

// e-Defter berat yükleme son günleri.
//
// Kaynak: 1 Sıra No.lu Elektronik Defter Genel Tebliği 4.3.4 ve GİB e-Defter sitesindeki duyurular
// (edefter.gov.tr; ör. 20/01/2026 "aylık veya geçici vergi dönemleri bazında yükleme" duyurusu ve
// 10/14 Mayıs 2026 son günlerini uzatan 198 Sıra No.lu VUK Sirküleri).
//   - Aylık yükleme: ilgili ayı izleyen 4. ayın 10'u (gelir vergisi) / 14'ü (kurumlar vergisi) sonu
//   - Geçici vergi dönemi bazında (1.–3. dönem): dönemin son ayını izleyen 2. ayın 10'u / 14'ü sonu
//   - Ekim–Aralık (aylık 10–12 ve 4. dönem): kaynaklar arasında tutarsızlık olduğu için tarih
//     üretilmez; kullanıcı son günü elle girer.
// Süre uzatımları (VUK sirkülerleri) sık olduğundan her dönemin son günü elle değiştirilebilir.
// Resmi tatile denk gelen son gün ilk iş gününe kayar; burada sadece hafta sonu kaydırılır.

/** Şirketler kurumlar vergisi (14), şahıs/basit usul gelir vergisi (10) mükellefidir. */
export function dueDay(companyType: CompanyType): number {
  return companyType === 'SIRKET' ? 14 : 10;
}

function endOfDayShifted(year: number, monthIndex: number, day: number): Date {
  const d = new Date(year, monthIndex, day, 23, 59, 59);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/** Dönem kodundan kural son gününü üretir; kuralın tarih veremediği dönemlerde null. */
export function ruleDueDate(period: string, companyType: CompanyType): Date | null {
  const day = dueDay(companyType);
  let m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]); // 1–12
    if (month >= 10) return null; // Ekim–Aralık: elle girilmeli
    return endOfDayShifted(year, month - 1 + 4, day);
  }
  m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (m) {
    const year = Number(m[1]);
    const q = Number(m[2]);
    if (q === 4) return null;
    const lastMonthIndex = q * 3 - 1; // Q1 → Mart (2)
    return endOfDayShifted(year, lastMonthIndex + 2, day);
  }
  return null;
}

/** Kontrol ayı (ör. 2026-03) için beklenen berat dönemi: aylıkta o ay, dönemselde çeyrek sonu aylarında çeyrek. */
export function periodForMonth(year: number, month: number, pref: EDefterPreference): string | null {
  if (pref === 'MONTHLY') return `${year}-${String(month).padStart(2, '0')}`;
  return month % 3 === 0 ? `${year}-Q${month / 3}` : null;
}

export function eDefterPeriodLabel(period: string): string {
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  let m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return `${months[Number(m[2]) - 1]} ${m[1]}`;
  m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (m) {
    const q = Number(m[2]);
    return `${months[q * 3 - 3]}–${months[q * 3 - 1]} ${m[1]}`;
  }
  return period;
}
