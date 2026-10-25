import { isIntermediaryContract, type ContractRow } from './contract-list.ts';

// e-Beyanname kaydı (Declaration). Kaynak: ACL'in eworks.gib.declarations.v1 çıktısı. Kurallar eski portalın
// institution-review.js (prepare/prepareImport) ve robotun declaration_adapter'ından:
// - Beyanname yalnız AYNI OTURUMDA okunan listede geçerli "Aracılık ve Sorumluluk" sözleşmesi olan mükellef için kabul edilir;
//   kanıttaki sözleşme numarası o listede o mükellefe ait olmalıdır.
// - Dönem ve yükleme tarihi sorgu kapsamıyla tutarlı olmalı; satır kimliği sorguda tekil olmalı.
// - Bir sorgu doğrulanmazsa yalnız o sorgu atlanır (sayılır); diğerleri uygulanır.

export type DeclarationRecord = {
  recordId: string;
  type: string;
  periodStart: string; // YYYY-MM
  periodEnd: string;
  uploadedAt: string; // ISO, saat dilimli
  taxStatus: string;
  sgkStatus: string;
  branch: string;
  reference: string;
  referenceType: 'source_filename' | 'source_record_id';
  documents: { kind: DocumentKind; key: string; sha256: string; size: number }[];
  documentWarnings: string[];
  /** Yalnız MUHSGK: SGK bildirimleri — social-security bağlamı uygular (tax-filing içeriğini yorumlamaz). */
  sgk?: unknown[];
};

export type DocumentKind = 'declaration' | 'tax_accrual' | 'sgk_accrual' | 'sgk_service';

export type DeclarationQuery = {
  identity: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  outcome: 'ok' | 'empty' | 'failed' | 'no_access';
  message?: string;
  access?: { method: 'same_session_contract'; contractNumbers: string[] };
  records: DeclarationRecord[];
};

export type QueryCheck = { ok: true; records: DeclarationRecord[] } | { ok: false; reason: 'erisim_kaniti_yok' | 'kayit_gecersiz' };

const AY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const KAYIT = /^([A-Za-z0-9_-]{1,100}|encoded-[0-9a-f]{64})$/;

/** Sorgunun erişim kanıtı aynı oturumdaki sözleşme listesinde bu mükellefin Aracılık ve Sorumluluk sözleşmesiyle eşleşiyor mu? */
export function hasSameSessionAccess(q: DeclarationQuery, contracts: readonly ContractRow[]): boolean {
  const numbers = q.access?.contractNumbers ?? [];
  if (q.access?.method !== 'same_session_contract' || numbers.length === 0) return false;
  const own = contracts.filter((c) => (c.taxNumber === q.identity || c.identityNumber === q.identity) && isIntermediaryContract(c.type));
  return numbers.every((n) => own.some((c) => c.number.trim() === n));
}

/** Kayıtları sorgu kapsamına göre doğrular (fail-closed: tek bozuk kayıt sorgunun tamamını geçersiz kılar). */
export function checkQuery(q: DeclarationQuery, contracts: readonly ContractRow[]): QueryCheck {
  if (!hasSameSessionAccess(q, contracts)) return { ok: false, reason: 'erisim_kaniti_yok' };
  const seen = new Set<string>();
  for (const r of q.records) {
    if (!KAYIT.test(r.recordId) || seen.has(r.recordId)) return { ok: false, reason: 'kayit_gecersiz' };
    seen.add(r.recordId);
    if (!AY.test(r.periodStart) || !AY.test(r.periodEnd) || r.periodStart > r.periodEnd) return { ok: false, reason: 'kayit_gecersiz' };
    const day = istanbulDay(r.uploadedAt);
    if (!day || day < q.startDate || day > q.endDate) return { ok: false, reason: 'kayit_gecersiz' };
    if (!/^[A-Z0-9_-]{1,30}$/.test(r.type) || !r.taxStatus.trim() || !r.reference.trim()) return { ok: false, reason: 'kayit_gecersiz' };
  }
  return { ok: true, records: q.records };
}

/** ISO zaman → İstanbul günü (YYYY-MM-DD). */
export function istanbulDay(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
}

/** Senkron kapsamı (kullanıcı isteği): ay aralığı → gün aralığı; gelecek kısmı bugüne kırpılır, en çok 12 ay. */
export function syncScope(from: string, to: string, today: string): { ok: true; startDate: string; endDate: string } | { ok: false; error: 'gecersiz_aralik' } {
  const a = AY.exec(from);
  const b = AY.exec(to);
  if (!a || !b || from > to || from < '2004-01' || from > today.slice(0, 7)) return { ok: false, error: 'gecersiz_aralik' };
  const months = (Number(b[1]) - Number(a[1])) * 12 + Number(b[2]) - Number(a[2]) + 1;
  if (months > 12) return { ok: false, error: 'gecersiz_aralik' };
  const last = new Date(Date.UTC(Number(b[1]), Number(b[2]), 0)).toISOString().slice(0, 10);
  return { ok: true, startDate: `${from}-01`, endDate: last < today ? last : today };
}

/** "2026-08" → "08/2026"; aralıksa "07/2026–09/2026". */
export function periodLabel(start: string, end: string) {
  const f = (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`;
  return start === end ? f(start) : `${f(start)}–${f(end)}`;
}
