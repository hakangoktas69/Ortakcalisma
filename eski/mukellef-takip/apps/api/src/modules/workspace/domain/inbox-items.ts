/**
 * İş kutusu öğeleri ve sıralama kuralları (veritabanından bağımsız, test edilebilir).
 * Her öğenin anahtarı kararlıdır: aynı iş her açılışta aynı anahtarla gelir, erteleme bu anahtara bağlanır.
 */

export type InboxKind = 'declaration' | 'tebligat' | 'report' | 'berat' | 'payroll' | 'license';
export type InboxSeverity = 'late' | 'soon' | 'normal';

export interface InboxItem {
  key: string;
  kind: InboxKind;
  severity: InboxSeverity;
  title: string;
  subtitle: string;
  company: { id: string; title: string; taxNumber: string } | null;
  /** Son gün (varsa) */
  dueDate: string | null;
  /** İşin oluştuğu / ilgili tarih (listede gösterilir, son gün yoksa sıralamada kullanılır) */
  date: string;
  /** Türe özgü ayrıntılar (detay panelinde gösterilir) */
  detail: Record<string, unknown>;
  snoozedUntil: string | null;
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function daysUntil(due: Date, now: Date) {
  return Math.round((startOfDay(due) - startOfDay(now)) / DAY);
}

/** Son güne göre önem: geçmişse "gecikti", 3 gün içindeyse "yaklaşıyor" */
export function severityForDue(due: Date | null, now: Date, late = false): InboxSeverity {
  if (late) return 'late';
  if (!due) return 'normal';
  const n = daysUntil(due, now);
  if (n < 0) return 'late';
  return n <= 3 ? 'soon' : 'normal';
}

const RANK: Record<InboxSeverity, number> = { late: 0, soon: 1, normal: 2 };

/** Önce gecikenler, sonra yaklaşanlar; aynı grupta son günü en yakın olan üstte, son günü olmayanlar en yenisi üstte */
export function sortInbox(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    if (RANK[a.severity] !== RANK[b.severity]) return RANK[a.severity] - RANK[b.severity];
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return b.date.localeCompare(a.date);
  });
}

export interface InboxCounts {
  all: number;
  late: number;
  soon: number;
  snoozed: number;
  byKind: Record<InboxKind, number>;
}

export function countInbox(items: InboxItem[], now: Date): InboxCounts {
  const active = items.filter((i) => !i.snoozedUntil || new Date(i.snoozedUntil) <= now);
  const byKind: Record<InboxKind, number> = { declaration: 0, tebligat: 0, report: 0, berat: 0, payroll: 0, license: 0 };
  for (const i of active) byKind[i.kind]++;
  return {
    all: active.length,
    late: active.filter((i) => i.severity === 'late').length,
    soon: active.filter((i) => i.severity === 'soon').length,
    snoozed: items.length - active.length,
    byKind,
  };
}

export { maskTckn } from '../../../shared-kernel/tckn.js';
