import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { CompanyType } from '../generated/prisma/enums.js';
import { norm } from '../declarations/import/table-parser.js';

// Excel/CSV'den firma aktarımı: dosyayı satırlara çevirir ve her satırı doğrular.
// Veritabanına dokunmaz; mevcut firmalarla karşılaştırma ve kota servis katmanında yapılır.

export const TEMPLATE_HEADERS = ['Unvan / Ad Soyad', 'VKN / TCKN', 'Tür', 'Vergi Dairesi', 'Telefon', 'E-posta'] as const;
export const MAX_ROWS = 2000;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 30 * 1024 * 1024;

/**
 * .xlsx bir zip arşividir; küçük bir dosya açıldığında çok büyüyebilir ("zip bombası").
 * Açmadan önce arşivdeki dosyaların bildirilen sıkıştırılmamış boyutlarının toplamına bakılır.
 */
export async function assertSafeXlsx(buf: Buffer) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf, { checkCRC32: false });
  } catch {
    throw new Error('Dosya okunamadı: geçerli bir .xlsx değil');
  }
  let total = 0;
  zip.forEach((_, file) => {
    total += (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  });
  if (total > MAX_UNZIPPED_BYTES) throw new Error('Dosya açıldığında çok büyük; lütfen sadece firma listesini içeren bir dosya yükleyin');
}

export interface ImportRow {
  row: number; // Dosyadaki satır numarası (başlık 1. satır)
  title: string;
  taxNumber: string;
  type: CompanyType | null;
  taxOffice: string | null;
  phone: string | null;
  email: string | null;
  errors: string[];
  warnings: string[];
}

type Field = 'title' | 'taxNumber' | 'type' | 'taxOffice' | 'phone' | 'email';

const HEADER_PATTERNS: [Field, RegExp][] = [
  ['taxNumber', /(vkn|tckn|vergi (kimlik|no)|kimlik no|t\.?c\.?)/],
  ['taxOffice', /(vergi dairesi|^vd$|daire)/],
  ['title', /(unvan|ad soyad|firma|musteri|mukellef)/],
  ['type', /(^tur$|turu|tip|mukellefiyet)/],
  ['phone', /(telefon|tel|gsm|cep)/],
  ['email', /(e-?posta|mail)/],
];

export function mapHeaders(headers: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [f, re] of HEADER_PATTERNS) {
      if (map[f] === undefined && re.test(n)) {
        map[f] = i;
        break;
      }
    }
  });
  return map;
}

export function parseCompanyType(raw: string): CompanyType | null {
  const n = norm(raw);
  if (!n) return null;
  if (/basit/.test(n)) return 'BASIT_USUL';
  if (/(sahis|serbest|isletme|gercek)/.test(n)) return 'SAHIS';
  if (/(sirket|ltd|limited|a\.?s\.?$|anonim|kurum|tuzel)/.test(n)) return 'SIRKET';
  return null;
}

/** T.C. kimlik no kontrol haneleri (resmi algoritma). */
export function isValidTckn(s: string): boolean {
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = [...s].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Tek bir satırı doğrular ve normalleştirir. */
export function validateRow(row: number, cells: Partial<Record<Field, string>>): ImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const title = (cells.title ?? '').replace(/\s+/g, ' ').trim();
  const taxNumber = (cells.taxNumber ?? '').replace(/\D/g, '');
  const rawType = (cells.type ?? '').trim();
  let type = parseCompanyType(rawType);

  if (!title) errors.push('Unvan boş');
  else if (title.length < 2) errors.push('Unvan çok kısa');
  if (taxNumber.length !== 10 && taxNumber.length !== 11) errors.push('VKN 10, TCKN 11 haneli olmalı');
  else if (taxNumber.length === 11 && !isValidTckn(taxNumber)) warnings.push('T.C. kimlik no kontrol haneleri tutmuyor');

  if (rawType && !type) errors.push(`Tür anlaşılamadı: "${rawType}" (Şirket / Şahıs / Basit Usul)`);
  if (!rawType && (taxNumber.length === 10 || taxNumber.length === 11)) {
    type = taxNumber.length === 10 ? 'SIRKET' : 'SAHIS';
    warnings.push(`Tür boş; numara uzunluğundan "${type === 'SIRKET' ? 'Şirket' : 'Şahıs'}" varsayıldı`);
  }

  const email = (cells.email ?? '').trim() || null;
  if (email && !EMAIL_RE.test(email)) errors.push('E-posta geçersiz');
  const phone = (cells.phone ?? '').trim() || null;

  return { row, title, taxNumber, type, taxOffice: (cells.taxOffice ?? '').trim() || null, phone, email, errors, warnings };
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toLocaleDateString('tr-TR');
  if (typeof v === 'object' && 'text' in v) return String((v as { text: unknown }).text ?? ''); // köprü
  if (typeof v === 'object' && 'richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
  if (typeof v === 'object' && 'result' in v) return String((v as ExcelJS.CellFormulaValue).result ?? ''); // formülün sonucu
  return String(v);
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** .xlsx veya .csv dosyasını başlık + satırlar olarak okur (ilk sayfa, ilk dolu satır başlık). */
export interface Sheet {
  headers: string[];
  /** Başlık satırının dosyadaki numarası */
  headerRow?: number;
  /** n: dosyadaki gerçek satır numarası (boş satırlar atlansa da kaymaz; kullanıcıya bu gösterilir) */
  rows: { n: number; cells: string[] }[];
}

export async function readSheet(buf: Buffer, filename: string): Promise<Sheet> {
  let all: { n: number; cells: string[] }[] = [];
  if (/\.csv$/i.test(filename)) {
    const lines = buf.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
    const first = lines.find((l) => l.trim()) ?? '';
    const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ',';
    all = lines.map((l, i) => ({ n: i + 1, cells: splitCsvLine(l, sep).map((x) => x.trim()) })).filter((r) => r.cells.some(Boolean));
  } else {
    await assertSafeXlsx(buf);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    if (!ws) return { headers: [], rows: [] };
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = (r.values as ExcelJS.CellValue[]).slice(1); // exceljs 1 tabanlı
      all.push({ n: r.number, cells: vals.map((v) => cellText(v).trim()) });
    });
  }
  const [header, ...rows] = all;
  return { headers: header?.cells ?? [], headerRow: header?.n, rows };
}

/** Okunan sayfayı doğrulanmış satırlara çevirir; dosya içindeki tekrarlanan VKN'leri işaretler. */
export function toImportRows(sheet: Sheet) {
  const map = mapHeaders(sheet.headers);
  const missing = (['title', 'taxNumber'] as Field[]).filter((f) => map[f] === undefined);
  if (missing.length) {
    return { error: 'Dosyada "Unvan" ve "VKN / TCKN" sütunları bulunmalı. Şablonu indirip onu kullanın.', rows: [] as ImportRow[] };
  }
  if (sheet.rows.length > MAX_ROWS) return { error: `Bir seferde en fazla ${MAX_ROWS} satır aktarılabilir.`, rows: [] as ImportRow[] };

  const seen = new Map<string, number>();
  const rows = sheet.rows
    .filter(({ cells }) => cells.some((c) => c && c.trim()))
    .map(({ cells, n: row }) => {
      const pick = (f: Field) => (map[f] === undefined ? undefined : cells[map[f]!]);
      const r = validateRow(row, { title: pick('title'), taxNumber: pick('taxNumber'), type: pick('type'), taxOffice: pick('taxOffice'), phone: pick('phone'), email: pick('email') });
      if (r.taxNumber && seen.has(r.taxNumber)) r.errors.push(`Aynı VKN dosyada ${seen.get(r.taxNumber)}. satırda da var`);
      else if (r.taxNumber) seen.set(r.taxNumber, row);
      return r;
    });
  return { error: null, rows };
}

/** İndirilebilir şablon: başlıklar, örnek satır ve açıklama sayfası. */
export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Firmalar');
  ws.addRow([...TEMPLATE_HEADERS]);
  ws.addRow(['Örnek Gıda Ltd. Şti.', '1234567890', 'Şirket', 'Kadıköy', '0216 000 00 00', 'info@ornek.com']);
  ws.addRow(['Ayşe Örnek', '10000000146', 'Şahıs', 'Beşiktaş', '', '']);
  ws.getRow(1).font = { bold: true };
  ws.columns = [{ width: 36 }, { width: 16 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 28 }];
  // VKN/TCKN metin olsun: Excel baştaki sıfırı veya uzun sayıyı bozmasın
  ws.getColumn(2).numFmt = '@';
  const help = wb.addWorksheet('Açıklama');
  [
    ['Firma aktarım şablonu'],
    [''],
    ['• "Unvan / Ad Soyad" ve "VKN / TCKN" zorunludur.'],
    ['• Tür: Şirket, Şahıs veya Basit Usul. Boş bırakılırsa 10 haneli numara Şirket, 11 haneli Şahıs sayılır.'],
    ['• Portalda kayıtlı VKN\'ler güncellenir (boş hücreler mevcut bilgiyi silmez), yeniler eklenir.'],
    ['• Örnek satırları silin. Bir seferde en fazla 2000 satır.'],
  ].forEach((r) => help.addRow(r));
  help.getColumn(1).width = 100;
  help.getRow(1).font = { bold: true, size: 13 };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
