import JSZip from 'jszip';

/** Tek istekte yüklenebilecek dosyaların toplam boyutu (sıkıştırılmış) */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 20;
/** Tek bir fatura XML'inin en büyük açılmış boyutu */
const MAX_XML_BYTES = 5 * 1024 * 1024;
/** ZIP'ler açıldığında toplamda en fazla bu kadar veri okunur (zip bombasına karşı, gerçek okunan bayt sayılır) */
const MAX_TOTAL_UNZIPPED = 300 * 1024 * 1024;
export const MAX_INVOICES = 3000;

export interface UploadedInvoiceFile {
  originalname: string;
  buffer: Buffer;
}

export interface InvoiceFileReadResult {
  xmls: { name: string; content: string }[];
  skipped: { name: string; reason: string }[];
}

class LimitError extends Error {}

/** Dosyayı akış olarak açar; sınır aşılırsa okumayı durdurur (başlıktaki boyut bilgisine güvenmez). */
function readCapped(file: JSZip.JSZipObject, max: number, budget: { left: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = file.nodeStream('nodebuffer');
    stream.on('data', (chunk: Buffer) => {
      size += chunk.length;
      budget.left -= chunk.length;
      if (size > max || budget.left < 0) {
        stream.removeAllListeners('data');
        stream.pause();
        reject(new LimitError(size > max ? 'Dosya çok büyük' : 'Arşiv açıldığında çok büyük'));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', (e: Error) => reject(e));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const decode = (buf: Buffer) => buf.toString('utf8');
const isXmlName = (n: string) => /\.xml$/i.test(n);

/**
 * Yüklenen .xml ve .zip dosyalarından fatura XML'lerini çıkarır. ZIP içindeki klasörler gezilir,
 * iç içe ZIP açılmaz, XML olmayanlar (PDF, HTML önizleme vb.) atlanır.
 */
export async function readInvoiceFiles(files: UploadedInvoiceFile[]): Promise<InvoiceFileReadResult> {
  const xmls: InvoiceFileReadResult['xmls'] = [];
  const skipped: InvoiceFileReadResult['skipped'] = [];
  const budget = { left: MAX_TOTAL_UNZIPPED };

  for (const f of files) {
    const name = f.originalname;
    if (isXmlName(name)) {
      if (f.buffer.length > MAX_XML_BYTES) skipped.push({ name, reason: 'Dosya çok büyük' });
      else xmls.push({ name, content: decode(f.buffer) });
      continue;
    }
    if (!/\.zip$/i.test(name)) {
      skipped.push({ name, reason: 'Sadece .xml veya .zip yüklenebilir' });
      continue;
    }
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(f.buffer);
    } catch {
      skipped.push({ name, reason: 'ZIP açılamadı' });
      continue;
    }
    const entries = Object.values(zip.files).filter((e) => !e.dir);
    for (const entry of entries) {
      const entryName = `${name}/${entry.name}`;
      if (!isXmlName(entry.name)) {
        // Entegratörler XML'in yanına PDF/HTML koyar; bunlar sessizce atlanır, diğerleri raporlanır
        if (!/\.(pdf|html?|xslt?|txt)$/i.test(entry.name)) skipped.push({ name: entryName, reason: 'XML değil' });
        continue;
      }
      if (xmls.length >= MAX_INVOICES) {
        skipped.push({ name: entryName, reason: `Tek seferde en fazla ${MAX_INVOICES} fatura` });
        continue;
      }
      try {
        xmls.push({ name: entryName, content: decode(await readCapped(entry, MAX_XML_BYTES, budget)) });
      } catch (e) {
        if (e instanceof LimitError && budget.left < 0) throw new Error('Arşiv açıldığında çok büyük; daha küçük parçalar halinde yükleyin');
        skipped.push({ name: entryName, reason: e instanceof LimitError ? e.message : 'Okunamadı' });
      }
    }
  }
  if (xmls.length > MAX_INVOICES) {
    for (const x of xmls.splice(MAX_INVOICES)) skipped.push({ name: x.name, reason: `Tek seferde en fazla ${MAX_INVOICES} fatura` });
  }
  return { xmls, skipped };
}
