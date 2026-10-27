import { err, ok, type Result } from '@eworks/kernel';

// e-Tebligat liste kaydı (D45). Yalnız liste bilgisi: belge numarası ve türü, gönderen kurum/alt birim, gönderim, tebliğ ve
// mükellef okuma tarihi. Belge açılmaz, okundu işaretlenmez (belgeyi açmak tebliğ sonucu doğurabilir). Doğrulama fail-closed.

export type ValidNotice = {
  /** ACL'nin kurum kayıt kimliğinden ürettiği SHA-256 (kurum kimliği açık saklanmaz). */
  noticeKey: string;
  reference: string;
  documentType: string;
  sender: string;
  department: string;
  sentOn: string;
  deliveredOn: string | null;
  readOn: string | null;
};
export type NoticeList = { count: number; accountVerified: boolean; documentsOpened: boolean; records: readonly unknown[] };
export type NoticeListError = 'sayi_uyusmuyor' | 'tekrarlanan_kayit' | 'gecersiz_kayit' | 'hesap_dogrulanmadi' | 'belge_acilmis';

const GUN = /^\d{4}-\d{2}-\d{2}$/;
const gun = (v: unknown): v is string => {
  if (typeof v !== 'string' || !GUN.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const metin = (v: unknown, bos = false): v is string => typeof v === 'string' && v.length <= 2000 && (bos || v.trim().length > 0);
const gunYaDaBos = (v: unknown): v is string | null => v === null || gun(v);

export function validateNoticeList(l: NoticeList): Result<ValidNotice[], NoticeListError> {
  if (l.accountVerified !== true) return err('hesap_dogrulanmadi');
  if (l.documentsOpened !== false) return err('belge_acilmis');
  if (!Array.isArray(l.records) || l.count !== l.records.length) return err('sayi_uyusmuyor');
  const out: ValidNotice[] = [];
  for (const ham of l.records) {
    if (typeof ham !== 'object' || ham === null) return err('gecersiz_kayit');
    const x = ham as Record<string, unknown>;
    const { noticeKey, reference, documentType, sender, department, sentOn, deliveredOn, readOn } = x;
    if (
      typeof noticeKey !== 'string' || !/^[a-f0-9]{64}$/.test(noticeKey) ||
      !metin(reference) || !metin(documentType) || !metin(sender) || !metin(department, true) ||
      !gun(sentOn) || !gunYaDaBos(deliveredOn) || !gunYaDaBos(readOn)
    ) {
      return err('gecersiz_kayit');
    }
    out.push({ noticeKey, reference: reference.trim(), documentType: documentType.trim(), sender: sender.trim(), department: department.trim(), sentOn, deliveredOn, readOn });
  }
  if (new Set(out.map((x) => x.noticeKey)).size !== out.length) return err('tekrarlanan_kayit');
  return ok(out);
}

/** Okuma tarihinin olmaması hukuken "tebliğ edilmedi" anlamına gelmez; arayüz yorum yapmaz. */
export const noticeStatusLabel = (n: { readOn: string | null }) => (n.readOn ? `Okundu (${n.readOn.split('-').reverse().join('.')})` : 'Okuma tarihi yok');
