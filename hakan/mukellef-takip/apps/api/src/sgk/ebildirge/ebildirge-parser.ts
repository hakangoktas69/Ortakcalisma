import { norm, parseTrAmount, parseTrDateTime, type RawTable } from '../../declarations/import/table-parser.js';

// SGK e-Bildirge "onaylı bildirgeler" listesini (eklentinin okuduğu tablolar) belgelere çevirir.
//
// DİKKAT: SGK ekranının gerçek sütun başlıkları henüz canlı bir hesapla doğrulanmadı. Tanıma, olası
// başlık yazımlarını kapsayan kalıplarla yapılır; tanınmayan tablolar ve başlıklar raporlanır.

export interface ParsedBildirge {
  period: string; // "2026-09"
  documentType: string; // "01"
  lawNo: string; // "05510" ya da "-"
  kind: 'ASIL' | 'EK' | 'IPTAL';
  insuredCount: number | null;
  totalDays: number | null;
  premiumBase: number | null;
  accrualAmount: number | null;
  approvedAt: Date | null;
  referenceNo: string | null;
  registryDigits: string | null; // Satırda işyeri sicil no varsa (rakamlar)
}

export interface BildirgeParseResult {
  documents: ParsedBildirge[];
  tablesUsed: number;
  unreadablePeriods: string[];
}

type Field =
  | 'period'
  | 'year'
  | 'month'
  | 'documentType'
  | 'lawNo'
  | 'kind'
  | 'insuredCount'
  | 'totalDays'
  | 'premiumBase'
  | 'accrual'
  | 'approvedAt'
  | 'reference'
  | 'registry';

// Sıra önemli: daha özel kalıplar önce (ör. "prime esas kazanç" "prim"den önce).
const PATTERNS: [Field, RegExp][] = [
  ['registry', /(sicil|isyeri no)/],
  ['premiumBase', /(prime esas|^pek( |$)|kazanc)/],
  ['totalDays', /(gun sayisi|prim (odeme )?gun|toplam gun|^gun$)/],
  ['insuredCount', /(sigortali sayisi|kisi sayisi|calisan sayisi|^sigortali$|^kisi$)/],
  ['accrual', /(tahakkuk|prim tutari|toplam prim|odenecek|^tutar$)/],
  ['documentType', /(belge (turu|cesidi|tipi|kodu))/],
  ['lawNo', /(kanun)/],
  ['kind', /(mahiyet|belge mahiyeti)/],
  ['approvedAt', /(onay (tarihi|zamani)|gonderim|kayit tarihi|onaylanma)/],
  ['reference', /(belge no|referans|onay no|tahakkuk fis|^no$)/],
  ['year', /^yil$/],
  ['month', /^ay$/],
  ['period', /(donem|yil.?ay|ay.?yil|hizmet (yili|donemi))/],
];

export function mapBildirgeHeaders(headers: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [f, re] of PATTERNS) {
      if (map[f] === undefined && re.test(n)) {
        map[f] = i;
        break;
      }
    }
  });
  return map;
}

const MONTHS = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];

/** "2026/09", "09/2026", "2026-09", "Eylül 2026", "202609" → "2026-09" */
export function parseBildirgePeriod(raw: string): string | null {
  const n = norm(raw);
  const ok = (y: number, m: number) => (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 ? `${y}-${String(m).padStart(2, '0')}` : null);
  let m = /^(\d{4})\s*[/.-]\s*(\d{1,2})$/.exec(n);
  if (m) return ok(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(n);
  if (m) return ok(Number(m[2]), Number(m[1]));
  m = /^(\d{4})(\d{2})$/.exec(n);
  if (m) return ok(Number(m[1]), Number(m[2]));
  m = new RegExp(`(${MONTHS.join('|')})\\s*[/ ]?\\s*(\\d{4})`).exec(n);
  if (m) return ok(Number(m[2]), MONTHS.indexOf(m[1]) + 1);
  return null;
}

export function parseKind(raw: string): ParsedBildirge['kind'] {
  const n = norm(raw);
  if (/iptal/.test(n)) return 'IPTAL';
  if (/^ek\b|ek belge|^e$/.test(n)) return 'EK';
  return 'ASIL';
}

const intOrNull = (raw: string) => {
  const d = raw.replace(/[^\d]/g, '');
  return d ? Number(d) : null;
};

/** Sicil numarasındaki rakamlar; işyeri sicili için en az 20 rakam aranır. */
export function registryDigits(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  return d.length >= 20 ? d : null;
}

/**
 * İki sicil numarası aynı işyerini mi gösteriyor? Rakamlar karşılaştırılır; sonundaki aracı numarası
 * bir tarafta olup diğerinde olmayabilir, bu yüzden en az 20 rakamlık ortak başlangıç yeterli sayılır.
 */
export function sameRegistry(a: string, b: string): boolean {
  const x = a.replace(/\D/g, '');
  const y = b.replace(/\D/g, '');
  if (x.length < 20 || y.length < 20) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

export function parseBildirgeTables(tables: RawTable[]): BildirgeParseResult {
  const result: BildirgeParseResult = { documents: [], tablesUsed: 0, unreadablePeriods: [] };
  const unreadable = new Set<string>();
  const seen = new Set<string>();

  for (const t of tables) {
    const map = mapBildirgeHeaders(t.headers);
    const hasPeriod = map.period !== undefined || (map.year !== undefined && map.month !== undefined);
    const hasMeasure = map.insuredCount !== undefined || map.totalDays !== undefined || map.accrual !== undefined;
    const hasIdentity = map.documentType !== undefined || map.lawNo !== undefined;
    if (!hasPeriod || !hasMeasure || !hasIdentity) continue;
    result.tablesUsed++;
    const cell = (row: string[], f: Field) => (map[f] === undefined ? '' : (row[map[f]!] ?? '').trim());

    for (const row of t.rows) {
      if (!row.some((c) => c.trim())) continue;
      const rawPeriod = map.period !== undefined ? cell(row, 'period') : `${cell(row, 'year')}/${cell(row, 'month')}`;
      const period = parseBildirgePeriod(rawPeriod);
      if (!period) {
        if (rawPeriod.replace(/[/\s]/g, '')) unreadable.add(rawPeriod);
        continue;
      }
      const documentType = cell(row, 'documentType').replace(/\D/g, '').padStart(2, '0') || '00';
      const lawNo = cell(row, 'lawNo').replace(/\D/g, '') || '-';
      const doc: ParsedBildirge = {
        period,
        documentType,
        lawNo: lawNo === '-' ? '-' : lawNo.padStart(5, '0'),
        kind: parseKind(cell(row, 'kind')),
        insuredCount: intOrNull(cell(row, 'insuredCount')),
        totalDays: intOrNull(cell(row, 'totalDays')),
        premiumBase: parseTrAmount(cell(row, 'premiumBase')),
        accrualAmount: parseTrAmount(cell(row, 'accrual')),
        approvedAt: parseTrDateTime(cell(row, 'approvedAt')),
        referenceNo: cell(row, 'reference') || null,
        registryDigits: registryDigits(cell(row, 'registry')),
      };
      const key = `${doc.registryDigits ?? ''}|${period}|${doc.documentType}|${doc.lawNo}|${doc.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.documents.push(doc);
    }
  }
  result.unreadablePeriods = [...unreadable];
  return result;
}
