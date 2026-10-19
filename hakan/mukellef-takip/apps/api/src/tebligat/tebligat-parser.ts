import { createHash } from 'node:crypto';
import { mapHeaders as mapDeclarationHeaders, norm, parseTrDateTime, type RawTable } from '../declarations/import/table-parser.js';

// GİB e-Tebligat listesini (eklentinin okuduğu tablolar) tebligat kayıtlarına çevirir.
// Beyanname tablosu gibi sütun BAŞLIKLARINA bakar.

export interface ParsedTebligat {
  taxNumber: string | null; // Sayfada VKN sütunu yoksa null; kullanıcı eklentide firmayı belirtir
  documentNo: string;
  documentNoDerived: boolean; // Belge no sütunu yoksa içerikten türetildi
  sender: string | null;
  subject: string | null;
  deliveredAt: Date;
  deemedServedAt: Date;
  readAtGib: Date | null;
}

export interface TebligatParseResult {
  tebligats: ParsedTebligat[];
  tablesUsed: number;
  /** Tebligat tablosu var ama VKN sütunu yok: firma eklentiden seçilmeli */
  missingTaxNumberColumn: boolean;
  unreadableDates: number;
}

type Field = 'taxNumber' | 'documentNo' | 'sender' | 'subject' | 'deliveredAt' | 'readAt';

const PATTERNS: [Field, RegExp][] = [
  ['taxNumber', /(vergi kimlik|t\.?c\.? kimlik|tckn|vkn|kimlik no)/],
  ['readAt', /(okunma|okundu|acilma|goruntulenme)/],
  ['documentNo', /(belge (no|numarasi)|evrak (no|numarasi)|tebligat (no|numarasi)|^sayi$|^no$)/],
  ['sender', /(gonderen|birim|kurum|idare)/],
  ['subject', /(konu|baslik|belge turu|tebligat turu|evrak turu|aciklama)/],
  ['deliveredAt', /(gonderim|gonderilme|ulasma|tebligat tarihi|gelis|^tarih$|^tarihi$)/],
];

export function mapTebligatHeaders(headers: string[]): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [field, re] of PATTERNS) {
      if (map[field] === undefined && re.test(n)) {
        map[field] = i;
        break;
      }
    }
  });
  return map;
}

/** Ulaşma tarihini izleyen 5. günün sonu (VUK 107/A). Saat bilgisi önemsizdir, takvim günü esas alınır. */
export function deemedServedDate(deliveredAt: Date): Date {
  return new Date(deliveredAt.getFullYear(), deliveredAt.getMonth(), deliveredAt.getDate() + 5, 23, 59, 59);
}

export function parseTebligatTables(tables: RawTable[]): TebligatParseResult {
  const result: TebligatParseResult = { tebligats: [], tablesUsed: 0, missingTaxNumberColumn: false, unreadableDates: 0 };
  const seen = new Set<string>();

  for (const t of tables) {
    // Beyanname tablosuysa (tür + dönem sütunu var) tebligat sayma
    const decl = mapDeclarationHeaders(t.headers);
    if (decl.type !== undefined && decl.period !== undefined) continue;

    const map = mapTebligatHeaders(t.headers);
    if (map.deliveredAt === undefined || (map.subject === undefined && map.documentNo === undefined)) continue;
    result.tablesUsed++;
    if (map.taxNumber === undefined) result.missingTaxNumberColumn = true;
    const cell = (row: string[], f: Field) => (map[f] === undefined ? '' : (row[map[f]!] ?? '').trim());

    for (const row of t.rows) {
      const deliveredAt = parseTrDateTime(cell(row, 'deliveredAt'));
      if (!deliveredAt) {
        if (row.some((c) => c.trim())) result.unreadableDates++;
        continue;
      }
      const rawVkn = cell(row, 'taxNumber').replace(/\D/g, '');
      const taxNumber = rawVkn.length === 10 || rawVkn.length === 11 ? rawVkn : null;
      if (map.taxNumber !== undefined && !taxNumber) continue; // VKN sütunu var ama satırda geçerli değil (toplam satırı vb.)

      const sender = cell(row, 'sender') || null;
      const subject = cell(row, 'subject') || null;
      let documentNo = cell(row, 'documentNo');
      const documentNoDerived = !documentNo;
      if (!documentNo) {
        // Belge no yoksa aynı tebligatı tekrar aktarımda tanıyabilmek için içerikten kararlı bir anahtar
        documentNo =
          'T-' +
          createHash('sha256').update(`${taxNumber ?? ''}|${sender ?? ''}|${subject ?? ''}|${deliveredAt.toISOString()}`).digest('hex').slice(0, 16);
      }
      const key = `${taxNumber ?? ''}|${documentNo}`;
      if (seen.has(key)) continue;
      seen.add(key);

      result.tebligats.push({
        taxNumber,
        documentNo,
        documentNoDerived,
        sender,
        subject,
        deliveredAt,
        deemedServedAt: deemedServedDate(deliveredAt),
        readAtGib: parseTrDateTime(cell(row, 'readAt')),
      });
    }
  }
  return result;
}
