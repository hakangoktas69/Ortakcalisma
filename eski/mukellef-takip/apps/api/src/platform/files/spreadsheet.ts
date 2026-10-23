import ExcelJS from 'exceljs';
import JSZip from 'jszip';

// Kullanıcının yüklediği .xlsx / .csv tablolarını güvenli biçimde okur (firma aktarımı, bordro).

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
