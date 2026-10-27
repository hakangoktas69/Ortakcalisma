// PUBLIC API — notices bağlamı (D45): e-Tebligat (bugün GİB Dijital VD listesi, ileride UETS). Yalnız liste bilgisi; belge açılmaz.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/notices.md
export const CONTEXT = 'notices' as const;

export { noticeStatusLabel, validateNoticeList, type NoticeList, type NoticeListError, type ValidNotice } from './domain/notice.ts';
export { importNotices, listNotices, type Ctx, type NoticeRepository, type StoredNotice } from './application/notices.ts';
export { PgNoticeRepository } from './infrastructure/pg-notices.ts';
