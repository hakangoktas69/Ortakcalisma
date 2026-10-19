import { norm } from '../declarations/import/table-parser.js';
import { isValidTckn } from '../companies/company-import.js';

/**
 * Bordro programlarının Excel/CSV çıktısını (personel bazlı bordro listesi) sütun başlıklarından okur.
 * Programdan bağımsızdır: başlık satırı ilk satırlarda aranır, "TOPLAM" satırları atlanır.
 */

export type PayrollField =
  | 'tckn'
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'days'
  | 'gross'
  | 'sgkBase'
  | 'employeeSgk'
  | 'employeeUnemployment'
  | 'employerSgk'
  | 'employerUnemployment'
  | 'incomeTaxBase'
  | 'incomeTax'
  | 'stampTax'
  | 'net';

// Sıra önemli: daha özel kalıplar önce (ör. "SGK işveren payı" "SGK matrahı"ndan, "GV matrahı" "GV"den önce)
const PATTERNS: [PayrollField, RegExp][] = [
  ['tckn', /(t\.?c\.?( kimlik)?( no)?$|tckn|kimlik no)/],
  ['employerUnemployment', /(issizlik.*isveren|isveren.*issizlik)/],
  ['employeeUnemployment', /(issizlik.*(isci|sigortali)|(isci|sigortali).*issizlik|^issizlik( primi| payi)?$)/],
  ['employerSgk', /((sgk|sigorta|prim).*isveren|isveren.*(sgk|sigorta|prim|payi|hissesi))/],
  ['employeeSgk', /((sgk|sigorta|prim).*(isci|sigortali)|(isci|sigortali) (sgk|payi|primi|hissesi))/],
  ['sgkBase', /((sgk|prime esas|sigorta).*(matrah|kazanc)|^pek$)/],
  ['incomeTaxBase', /((gelir vergisi|gv).*matrah)/],
  ['incomeTax', /(^(kesilen |odenecek |hesaplanan )?(gelir vergisi|gv)( tutari| kesintisi)?$|^(kesilen|odenecek) (gelir vergisi|gv))/],
  ['stampTax', /^(kesilen |odenecek )?(damga( vergisi)?|dv)( tutari| kesintisi)?$/],
  ['net', /(net (ucret|odenen|ele gecen|maas)|^net$|ele gecen)/],
  ['gross', /(brut|toplam kazanc|toplam ucret|^kazanc toplami$)/],
  ['days', /((sgk |prim |calisma |odeme )?gun(u| sayisi)?$)/],
  ['fullName', /(ad[ıi]? ?soyad[ıi]?|adi soyadi|personel( adi)?$|calisan( adi)?$)/],
  ['firstName', /^ad[ıi]?$/],
  ['lastName', /^soyad[ıi]?$/],
];

export function mapPayrollHeaders(headers: string[]): Partial<Record<PayrollField, number>> {
  const map: Partial<Record<PayrollField, number>> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    // Kümülatif / önceki ay ve istisna sütunları aylık tutar değildir
    if (!n || /kumulatif|onceki|devreden|istisna/.test(n)) return;
    const hit = PATTERNS.find(([field, re]) => map[field] === undefined && re.test(n));
    if (hit) map[hit[0]] = i;
  });
  return map;
}

/** "33.000,50" (TR), "33000.5" (Excel sayısı), "33.000" (binlik ayraçlı) → sayı */
export function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export interface PayrollLineInput {
  row: number;
  tckn: string;
  fullName: string;
  days: number;
  gross: number;
  sgkBase: number;
  employeeSgk: number;
  employeeUnemployment: number;
  employerSgk: number | null;
  employerUnemployment: number | null;
  incomeTaxBase: number | null;
  incomeTax: number;
  stampTax: number;
  net: number;
  warnings: string[];
}

export interface PayrollParseResult {
  lines: PayrollLineInput[];
  errors: { row: number; message: string }[];
  headerRow: number | null;
  missingColumns: PayrollField[];
}

const REQUIRED: PayrollField[] = ['tckn', 'days', 'sgkBase'];
const LABEL: Record<PayrollField, string> = {
  tckn: 'T.C. Kimlik No',
  fullName: 'Adı Soyadı',
  firstName: 'Adı',
  lastName: 'Soyadı',
  days: 'Gün',
  gross: 'Brüt Ücret',
  sgkBase: 'SGK Matrahı',
  employeeSgk: 'SGK İşçi Payı',
  employeeUnemployment: 'İşsizlik İşçi Payı',
  employerSgk: 'SGK İşveren Payı',
  employerUnemployment: 'İşsizlik İşveren Payı',
  incomeTaxBase: 'Gelir Vergisi Matrahı',
  incomeTax: 'Gelir Vergisi',
  stampTax: 'Damga Vergisi',
  net: 'Net Ücret',
};
export const fieldLabel = (f: PayrollField) => LABEL[f];

/**
 * Kanunla sabit oranlar üzerinden satır kontrolü (tolerans 1 TL):
 * SGK işçi payı %14 (5510 md. 81: MYÖ %9 + GSS %5), işsizlik sigortası işçi payı %1 (4447 md. 49).
 * Gelir ve damga vergisi istisnalar nedeniyle burada hesaplanmaz; bordro programının sonucu esas alınır.
 */
export function lineWarnings(l: Pick<PayrollLineInput, 'days' | 'sgkBase' | 'employeeSgk' | 'employeeUnemployment' | 'gross' | 'net'>): string[] {
  const w: string[] = [];
  if (l.days > 30) w.push('SGK prim günü 30\'dan fazla olamaz');
  if (l.days === 0 && l.sgkBase > 0) w.push('Gün 0 iken SGK matrahı var');
  if (l.sgkBase > 0 && l.employeeSgk > 0 && Math.abs(l.employeeSgk - l.sgkBase * 0.14) > 1)
    w.push(`SGK işçi payı matrahın %14'üne uymuyor (beklenen ${(l.sgkBase * 0.14).toFixed(2)})`);
  if (l.sgkBase > 0 && l.employeeUnemployment > 0 && Math.abs(l.employeeUnemployment - l.sgkBase * 0.01) > 1)
    w.push(`İşsizlik işçi payı matrahın %1'ine uymuyor (beklenen ${(l.sgkBase * 0.01).toFixed(2)})`);
  if (l.gross > 0 && l.net > l.gross) w.push('Net ücret brütten büyük');
  return w;
}

export function parsePayrollSheet(allRows: { n: number; cells: string[] }[]): PayrollParseResult {
  // Başlık satırı: ilk 15 satırdan T.C. ve en az iki tutar sütunu tanınan ilki
  let headerIdx = -1;
  let map: Partial<Record<PayrollField, number>> = {};
  for (let i = 0; i < Math.min(allRows.length, 15); i++) {
    const m = mapPayrollHeaders(allRows[i].cells);
    const measures = (['days', 'gross', 'sgkBase', 'net', 'incomeTax'] as const).filter((f) => m[f] !== undefined).length;
    if (m.tckn !== undefined && measures >= 2) {
      headerIdx = i;
      map = m;
      break;
    }
  }
  if (headerIdx < 0) return { lines: [], errors: [], headerRow: null, missingColumns: REQUIRED };
  const missingColumns = REQUIRED.filter((f) => map[f] === undefined);
  if (missingColumns.length) return { lines: [], errors: [], headerRow: allRows[headerIdx].n, missingColumns };

  const lines: PayrollLineInput[] = [];
  const errors: PayrollParseResult['errors'] = [];
  const seen = new Set<string>();
  const cell = (cells: string[], f: PayrollField) => (map[f] === undefined ? undefined : (cells[map[f]!] ?? '').trim());
  const amt = (cells: string[], f: PayrollField) => parseAmount(cell(cells, f));

  for (const { n, cells } of allRows.slice(headerIdx + 1)) {
    const joined = norm(cells.join(' '));
    if (!joined) continue;
    const rawTckn = (cell(cells, 'tckn') ?? '').replace(/\D/g, '');
    if (!rawTckn) {
      if (/toplam|genel|ara toplam/.test(joined)) continue; // dip toplam satırları
      continue; // boş / açıklama satırı
    }
    if (!isValidTckn(rawTckn)) {
      errors.push({ row: n, message: `Geçersiz T.C. kimlik no (${rawTckn.slice(0, 3)}…)` });
      continue;
    }
    if (seen.has(rawTckn)) {
      errors.push({ row: n, message: 'Aynı kişi listede iki kez var' });
      continue;
    }
    seen.add(rawTckn);
    const fullName =
      cell(cells, 'fullName') || [cell(cells, 'firstName'), cell(cells, 'lastName')].filter(Boolean).join(' ') || '';
    const days = amt(cells, 'days');
    const sgkBase = amt(cells, 'sgkBase');
    if (days === null || sgkBase === null) {
      errors.push({ row: n, message: 'Gün veya SGK matrahı okunamadı' });
      continue;
    }
    const line = {
      row: n,
      tckn: rawTckn,
      fullName: fullName.slice(0, 120),
      days: Math.round(days),
      gross: amt(cells, 'gross') ?? sgkBase,
      sgkBase,
      employeeSgk: amt(cells, 'employeeSgk') ?? 0,
      employeeUnemployment: amt(cells, 'employeeUnemployment') ?? 0,
      employerSgk: amt(cells, 'employerSgk'),
      employerUnemployment: amt(cells, 'employerUnemployment'),
      incomeTaxBase: amt(cells, 'incomeTaxBase'),
      incomeTax: amt(cells, 'incomeTax') ?? 0,
      stampTax: amt(cells, 'stampTax') ?? 0,
      net: amt(cells, 'net') ?? 0,
    };
    lines.push({ ...line, warnings: lineWarnings(line) });
  }
  return { lines, errors, headerRow: allRows[headerIdx].n, missingColumns: [] };
}
