import { err, ok, type Result } from './result.ts';

// Dönem: aylık (2026-09), çeyreklik (2026-Q3) veya yıllık (2026).
export type Period =
  | { readonly kind: 'month'; readonly year: number; readonly month: number }
  | { readonly kind: 'quarter'; readonly year: number; readonly quarter: number }
  | { readonly kind: 'year'; readonly year: number };

export function parsePeriod(input: string): Result<Period, 'gecersiz_donem'> {
  const m = /^(\d{4})(?:-(?:(0[1-9]|1[0-2])|Q([1-4])))?$/.exec(input.trim());
  if (!m) return err('gecersiz_donem');
  const year = Number(m[1]);
  if (m[2]) return ok({ kind: 'month', year, month: Number(m[2]) });
  if (m[3]) return ok({ kind: 'quarter', year, quarter: Number(m[3]) });
  return ok({ kind: 'year', year });
}

export function formatPeriod(p: Period): string {
  if (p.kind === 'month') return `${p.year}-${String(p.month).padStart(2, '0')}`;
  if (p.kind === 'quarter') return `${p.year}-Q${p.quarter}`;
  return String(p.year);
}
