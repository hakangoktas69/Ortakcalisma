import ExcelJS from 'exceljs';
import type { CompanyType } from '../../../generated/prisma/enums.js';
import { norm } from '../../../shared-kernel/table-text.js';
import { isValidTckn } from '../../../shared-kernel/tckn.js';
import type { Sheet } from '../../../platform/files/spreadsheet.js';

// Ortak okuyucu ve kural; bu modülün dışa açık yüzeyi (testler ve bordro) için yeniden dışa aktarılır.
export { assertSafeXlsx, readSheet, type Sheet } from '../../../platform/files/spreadsheet.js';
export { isValidTckn };

// Excel/CSV'den firma aktarımı: dosyayı satırlara çevirir ve her satırı doğrular.
// Veritabanına dokunmaz; mevcut firmalarla karşılaştırma ve kota servis katmanında yapılır.

export const TEMPLATE_HEADERS = ['Unvan / Ad Soyad', 'VKN / TCKN', 'Tür', 'Vergi Dairesi', 'Telefon', 'E-posta'] as const;
export const MAX_ROWS = 2000;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

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
