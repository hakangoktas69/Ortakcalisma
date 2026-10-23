// Excel (Türkçe bölge ayarları) ile doğru açılan CSV: UTF-8 BOM, ";" ayraç, CRLF satır sonu.

/**
 * Hücre kaçışlama. "=", "+", "-", "@" (ve sekme/CR) ile başlayan metinler Excel'de formül olarak
 * çalışabilir (CSV/formül enjeksiyonu); başına tek tırnak eklenerek düz metne çevrilir.
 * Sayılar ve tarihler olduğu gibi bırakılır, böylece negatif tutarlar bozulmaz.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
  if (v instanceof Date) return v.toLocaleString('tr-TR');
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export const trDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString('tr-TR') : '');
