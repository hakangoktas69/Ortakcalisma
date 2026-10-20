// Kurum sayfalarından (GİB, SGK) eklentiyle okunan HTML tablolarının ortak metin yardımcıları.
// Saf fonksiyonlar; tüm context'lerin tablo ayrıştırıcıları kullanır.

/** Eklentinin gönderdiği ham tablo: başlıklar + hücre metinleri */
export interface RawTable {
  headers: string[];
  rows: string[][];
}

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Vergi Kimlik No" → "vergi kimlik no" */
export function norm(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c]!)
    .replace(/\s+/g, ' ')
    .trim();
}

/** "28.10.2026 14:35:12" veya "28.10.2026" → Date (yerel saat). */
export function parseTrDateTime(raw: string): Date | null {
  const m = /(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(raw);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 12), Number(m[5] ?? 0), Number(m[6] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12.345,67" veya "12345.67" → 12345.67 */
export function parseTrAmount(raw: string): number | null {
  const s = raw.replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
