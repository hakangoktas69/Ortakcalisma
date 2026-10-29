// Demo verisi — belgeler: /beyanname/belge ekranı demo kipinde boş kalmasın diye her beyannameye ve SGK satırına
// GERÇEK bir PDF üretir ve demo S3'e yazar. Uydurma bir belge satırı listede görünür ama indirilince kırılırdı;
// burada dosya gerçekten yazıldığı için indirme de çalışır.
//
// Belge anahtarı içeriğin SHA-256'sından türetilir (`storageKey`), bu yüzden aynı içerik aynı anahtara yazılır:
// tohumlayıcı tekrar çalıştırıldığında yeni nesne oluşmaz. PDF metni ASCII'dir (Helvetica'nın WinAnsi tablosu
// Türkçe harfleri doğru göstermez) ve üstünde demo olduğu yazar.
import { createHash } from 'node:crypto';
import { storageKey, type DocumentKind } from '@eworks/documents';
import type { DeclarationQuery, DeclarationRecord } from '@eworks/tax-filing';
import type { SgkFilingRecord } from '@eworks/social-security';

/** Depo portu: gerçek `Depo.koy` ile aynı sözleşme (yalnız yazma gerekir). */
export type BelgeDepo = { koy(anahtar: string, govde: Buffer, tur: string): Promise<unknown> };

export type BelgeTanimi = { kind: DocumentKind; key: string; sha256: string; size: number };

/** PDF dizesi: ters eğik çizgi ve parantez kaçırılır, ASCII dışı harfler sadeleştirilir. */
const pdfMetni = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/([\\()])/g, '\\$1');

/**
 * Tek sayfalık, geçerli bir PDF üretir (katalog, sayfa ağacı, Helvetica, xref tablosu). Aynı girdi aynı baytları
 * verir: tarih ya da rastgelelik içermez, böylece özet her koşuda aynı kalır.
 */
export function demoPdf(baslik: string, satirlar: readonly string[]): Buffer {
  const icerik = [
    'BT /F1 18 Tf 60 760 Td (' + pdfMetni(baslik) + ') Tj ET',
    ...satirlar.map((s, i) => `BT /F1 11 Tf 60 ${715 - i * 20} Td (${pdfMetni(s)}) Tj ET`),
  ].join('\n');

  const nesneler = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(icerik, 'latin1')} >>\nstream\n${icerik}\nendstream`,
  ];

  let govde = '%PDF-1.4\n';
  const konumlar: number[] = [];
  nesneler.forEach((n, i) => {
    konumlar.push(Buffer.byteLength(govde, 'latin1'));
    govde += `${i + 1} 0 obj\n${n}\nendobj\n`;
  });
  const xref = Buffer.byteLength(govde, 'latin1');
  govde += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n`;
  for (const k of konumlar) govde += `${String(k).padStart(10, '0')} 00000 n \n`;
  govde += `trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(govde, 'latin1');
}

const BASLIK: Record<DocumentKind, string> = {
  declaration: 'Beyanname',
  tax_accrual: 'Vergi Tahakkuk Fisi',
  sgk_accrual: 'SGK Tahakkuk Fisi',
  sgk_service: 'SGK Hizmet Listesi',
};

/** Belgeyi üretir, depoya yazar ve kaydı döner. Anahtar içerik özetinden geldiği için aynı belge tekrar yazılmaz. */
async function belgeYaz(org: string, depo: BelgeDepo, kind: DocumentKind, satirlar: readonly string[]): Promise<BelgeTanimi> {
  const pdf = demoPdf(BASLIK[kind], [...satirlar, 'DEMO - gercek belge degildir']);
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  const key = storageKey(org, sha256);
  await depo.koy(key, pdf, 'application/pdf');
  return { kind, key, sha256, size: pdf.length };
}

/**
 * Sorgulardaki her beyannameye (beyanname + tahakkuk) ve her MUHSGK satırına (SGK tahakkuku + hizmet listesi)
 * belge ekler; dosyaları depoya yazar. Kayıtların geri kalanına dokunulmaz, böylece erişim ve dönem denetimleri
 * eklemeden sonra da geçerli kalır.
 */
export async function belgeleriEkle(org: string, sorgular: readonly DeclarationQuery[], depo: BelgeDepo): Promise<DeclarationQuery[]> {
  const cikti: DeclarationQuery[] = [];
  for (const q of sorgular) {
    const records: DeclarationRecord[] = [];
    for (const r of q.records) {
      const donem = `${r.periodStart} donemi`;
      const documents = [
        await belgeYaz(org, depo, 'declaration', [r.type, donem, r.reference]),
        await belgeYaz(org, depo, 'tax_accrual', [r.type, donem, r.taxStatus]),
      ];
      const sgkSatirlari = (r.sgk as SgkFilingRecord[] | undefined) ?? [];
      const sgk: SgkFilingRecord[] = [];
      for (const s of sgkSatirlari) {
        sgk.push({
          ...s,
          documents: [
            await belgeYaz(org, depo, 'sgk_accrual', [`Isyeri ${s.workplace.slice(0, 4)}...${s.workplace.slice(-4)}`, `${s.period} donemi`, s.status]),
            await belgeYaz(org, depo, 'sgk_service', [`Isyeri ${s.workplace.slice(0, 4)}...${s.workplace.slice(-4)}`, `${s.period} donemi`, `${s.employeeCount ?? 0} calisan`]),
          ] as SgkFilingRecord['documents'],
        });
      }
      records.push({ ...r, documents, ...(sgkSatirlari.length > 0 ? { sgk } : {}) });
    }
    cikti.push({ ...q, records });
  }
  return cikti;
}
