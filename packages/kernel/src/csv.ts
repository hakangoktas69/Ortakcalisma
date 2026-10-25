// CSV dışa aktarım (Excel uyumlu: UTF-8 BOM, `;` ayraç, CRLF). Hücre `= + - @` ile başlıyorsa formül enjeksiyonuna
// karşı başına tırnak (') eklenir; tüm hücreler çift tırnak içinde, içteki tırnak ikilenir.
export type CsvColumn<T> = { readonly baslik: string; readonly deger: (row: T) => string | number | null | undefined };

const hucre = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  const guvenli = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guvenli.replace(/"/g, '""')}"`;
};

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const satirlar = [columns.map((c) => hucre(c.baslik)).join(';'), ...rows.map((r) => columns.map((c) => hucre(c.deger(r))).join(';'))];
  return `﻿${satirlar.join('\r\n')}\r\n`;
}
