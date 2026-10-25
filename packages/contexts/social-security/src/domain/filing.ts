// SGK bildirimi (EBildirgeDocument): MUHSGK beyannamesinin işyeri × ay satırı. Kurallar eski robotun muhsgk_sgk_reader'ından:
// işyeri sicil numarası 17–30 hane, dönem MUHSGK dönemi içinde, satır kimliği beyanname içinde tekil. Çalışan sayısı
// hizmet listesinden sayılır; tanınmayan listede sayı uydurulmaz (null).

export type SgkFilingRecord = {
  recordId: string;
  workplace: string;
  period: string; // YYYY-MM
  status: string;
  employeeCount: number | null;
  documents: { kind: 'sgk_accrual' | 'sgk_service'; key: string; sha256: string; size: number }[];
  documentWarnings: string[];
};

const KAYIT = /^([A-Za-z0-9_-]{1,100}|encoded-[0-9a-f]{64})$/;

/** Bir MUHSGK'nın SGK satırları; tek bozuk satır tümünü geçersiz kılar (fail-closed). */
export function checkFilings(rows: readonly SgkFilingRecord[], parent: { periodStart: string; periodEnd: string }): boolean {
  const seen = new Set<string>();
  for (const r of rows) {
    if (!KAYIT.test(r.recordId) || seen.has(r.recordId)) return false;
    seen.add(r.recordId);
    if (!/^[0-9]{17,30}$/.test(r.workplace)) return false;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.period) || r.period < parent.periodStart || r.period > parent.periodEnd) return false;
    if (!r.status.trim() || r.status.length > 200) return false;
    if (r.employeeCount !== null && (!Number.isInteger(r.employeeCount) || r.employeeCount < 0 || r.employeeCount > 100000)) return false;
  }
  return true;
}

/** İşyeri sicil numarası ekranda kısaltılır: ilk 4 ve son 4 hane. */
export const maskWorkplace = (w: string) => (w.length > 8 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w);
