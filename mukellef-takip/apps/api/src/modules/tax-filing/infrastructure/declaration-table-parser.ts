import type { DeclarationType } from '../../../generated/prisma/enums.js';
import { norm, parseTrAmount, parseTrDateTime, type RawTable } from '../../../shared-kernel/table-text.js';

export { norm, parseTrAmount, parseTrDateTime, type RawTable } from '../../../shared-kernel/table-text.js';

// Tarayıcı eklentisinin GİB e-Beyanname sayfasından okuduğu HTML tablolarını beyanname kayıtlarına çevirir.
//
// Sayfa düzenine değil sütun BAŞLIKLARINA bakar: GİB arayüzü değişse de başlıklar aynı kaldıkça çalışır.
// Tanınmayan sütun, tür ve dönemler sessizce atlanmaz; sonuçta ayrıca raporlanır.

export interface ParsedDeclaration {
  taxNumber: string;
  type: DeclarationType;
  period: string;
  filedAt: Date | null;
  accrualAmount: number | null;
  referenceNo: string | null;
  rawType: string;
  rawPeriod: string;
}

export interface ParseResult {
  declarations: ParsedDeclaration[];
  /** Beyanname tablosu sayılan (VKN + tür + dönem sütunu bulunan) tablo sayısı */
  tablesUsed: number;
  /** Onaylanmamış (hatalı, reddedilmiş, iptal…) olduğu için atlanan satırlar */
  skippedNotApproved: number;
  unknownTypes: string[];
  unknownPeriods: string[];
  /** Beyanname tablosu olarak tanınmayan tabloların başlıkları (teşhis için) */
  ignoredTableHeaders: string[][];
}

type Field = 'taxNumber' | 'type' | 'period' | 'status' | 'filedAt' | 'accrual' | 'reference';

const HEADER_PATTERNS: [Field, RegExp][] = [
  ['taxNumber', /(vergi kimlik|t\.?c\.? kimlik|tckn|vkn|kimlik no)/],
  ['type', /(beyanname (turu|tipi|kodu|adi)|^beyanname$|^tur$|^turu$)/],
  ['period', /(donem|vergilendirme)/],
  ['status', /(durum)/],
  ['filedAt', /(onay (zamani|tarihi)|yukleme (zamani|tarihi)|gonderim|verilis|kabul)/],
  ['accrual', /(tahakkuk (tutari|edilen)|odenecek|tutar)/],
  ['reference', /(oid|referans|beyanname no|tahakkuk no|sira no)/],
];

/** Başlıkları alanlara eşler; her alan için ilk eşleşen sütun alınır. */
export function mapHeaders(headers: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [field, re] of HEADER_PATTERNS) {
      if (map[field] === undefined && re.test(n)) {
        map[field] = i;
        break;
      }
    }
  });
  return map;
}

// GİB e-Beyanname tür kodları ve uzun adları. Listede olmayanlar "tanınmayan tür" olarak raporlanır.
const TYPE_PATTERNS: [DeclarationType, RegExp][] = [
  ['KDV1', /^(kdv ?1|katma deger vergisi( beyannamesi)?( \(?kdv ?1\)?)?)$/],
  ['MUHSGK', /^(muhsgk|muhtasar ve prim hizmet( beyannamesi)?)$/],
  ['DAMGA', /^(damga|damga vergisi( beyannamesi)?)$/],
  ['GECICI_VERGI', /^(ggecici|kgecici|gelir gecici( vergi)?( beyannamesi)?|kurumlar gecici( vergi)?( beyannamesi)?|gecici vergi( beyannamesi)?)$/],
  ['YILLIK_GELIR', /^(gelir|yillik gelir( vergisi)?( beyannamesi)?)$/],
  ['KURUMLAR', /^(kurumlar|kurumlar vergisi( beyannamesi)?)$/],
];

export function parseType(raw: string): DeclarationType | null {
  const n = norm(raw);
  for (const [type, re] of TYPE_PATTERNS) if (re.test(n)) return type;
  return null;
}

const MONTHS = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];

/**
 * Dönem metnini bizim dönem koduna çevirir.
 *   Aylık:   "09/2026", "2026/09", "Eylül 2026", "Eylül/2026", "01.09.2026-30.09.2026" → "2026-09"
 *   3 aylık: "07/2026-09/2026", "2026/3. Dönem" → "2026-Q3" (geçici vergi)
 *   Yıllık:  "2025", "01/2025-12/2025" → "2025"
 */
export function parsePeriod(raw: string, type: DeclarationType): string | null {
  const n = norm(raw);
  const yearly = type === 'YILLIK_GELIR' || type === 'KURUMLAR';
  const quarterly = type === 'GECICI_VERGI';

  // Aralık: mm/yyyy-mm/yyyy veya dd.mm.yyyy-dd.mm.yyyy
  const range = /(?:\d{1,2}[./])?(\d{1,2})[./](\d{4})\s*-\s*(?:\d{1,2}[./])?(\d{1,2})[./](\d{4})/.exec(n);
  if (range) {
    const [, m1, y1, m2, y2] = range.map(Number);
    if (yearly && m1 === 1 && m2 === 12 && y1 === y2) return String(y1);
    if (quarterly && y1 === y2 && m2 - m1 === 2 && m2 % 3 === 0 && m2 <= 9) return `${y2}-Q${m2 / 3}`;
    if (!yearly && !quarterly && m1 === m2 && y1 === y2) return `${y1}-${String(m1).padStart(2, '0')}`;
    return null;
  }

  // "2026/3. dönem" veya "3. dönem 2026"
  const q = /(\d{4})\s*\/?\s*([1-4])\s*\.?\s*donem|([1-4])\s*\.?\s*donem\s*\/?\s*(\d{4})/.exec(n);
  if (q && quarterly) {
    const year = q[1] ?? q[4];
    const nth = Number(q[2] ?? q[3]);
    return nth <= 3 ? `${year}-Q${nth}` : null;
  }

  if (yearly) {
    const y = /^(\d{4})$/.exec(n);
    return y ? y[1] : null;
  }

  // Ay adıyla: "eylul 2026", "eylul/2026"
  const named = new RegExp(`(${MONTHS.join('|')})\\s*[/ ]\\s*(\\d{4})`).exec(n);
  if (named && !quarterly) return `${named[2]}-${String(MONTHS.indexOf(named[1]) + 1).padStart(2, '0')}`;

  // "09/2026" veya "2026/09"
  const my = /^(\d{1,2})[./](\d{4})$/.exec(n);
  if (my && !quarterly) return `${my[2]}-${my[1].padStart(2, '0')}`;
  const ym = /^(\d{4})[./-](\d{1,2})$/.exec(n);
  if (ym && !quarterly) return `${ym[1]}-${ym[2].padStart(2, '0')}`;

  return null;
}

const NOT_APPROVED = /(hatali|red|iptal|onay bekl|kontrol ediliyor|gonderilmedi)/;

export function parseTables(tables: RawTable[]): ParseResult {
  const result: ParseResult = {
    declarations: [],
    tablesUsed: 0,
    skippedNotApproved: 0,
    unknownTypes: [],
    unknownPeriods: [],
    ignoredTableHeaders: [],
  };
  const unknownTypes = new Set<string>();
  const unknownPeriods = new Set<string>();
  const seen = new Set<string>();

  for (const t of tables) {
    const map = mapHeaders(t.headers);
    if (map.taxNumber === undefined || map.type === undefined || map.period === undefined) {
      if (t.headers.length) result.ignoredTableHeaders.push(t.headers);
      continue;
    }
    result.tablesUsed++;
    const cell = (row: string[], f: Field) => (map[f] === undefined ? '' : (row[map[f]!] ?? '').trim());

    for (const row of t.rows) {
      const taxNumber = cell(row, 'taxNumber').replace(/\D/g, '');
      if (taxNumber.length !== 10 && taxNumber.length !== 11) continue;

      const status = cell(row, 'status');
      if (status && NOT_APPROVED.test(norm(status))) {
        result.skippedNotApproved++;
        continue;
      }

      const rawType = cell(row, 'type');
      const type = parseType(rawType);
      if (!type) {
        if (rawType) unknownTypes.add(rawType);
        continue;
      }
      const rawPeriod = cell(row, 'period');
      const period = parsePeriod(rawPeriod, type);
      if (!period) {
        if (rawPeriod) unknownPeriods.add(`${rawType}: ${rawPeriod}`);
        continue;
      }

      const key = `${taxNumber}|${type}|${period}`;
      if (seen.has(key)) continue; // Aynı sayfada aynı beyanname birden fazla görünebilir
      seen.add(key);

      result.declarations.push({
        taxNumber,
        type,
        period,
        filedAt: parseTrDateTime(cell(row, 'filedAt')),
        accrualAmount: parseTrAmount(cell(row, 'accrual')),
        referenceNo: cell(row, 'reference') || null,
        rawType,
        rawPeriod,
      });
    }
  }
  result.unknownTypes = [...unknownTypes];
  result.unknownPeriods = [...unknownPeriods];
  return result;
}
