// PUBLIC API — social-security bağlamı: SGK işyeri, e-Bildirge, işe giriş/çıkış, e-Rapor, iş kazası, kontrol listesi.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/social-security.md
export const CONTEXT = 'social-security' as const;

export { checkFilings, maskWorkplace, type SgkFilingRecord } from './domain/filing.ts';
export {
  getFiling,
  importFilings,
  listFilings,
  sgkControl,
  type Ctx,
  type FilingDocumentPort,
  type FilingMeta,
  type FilingRepository,
  type FilingSummary,
  type SgkControlCell,
  type SgkControlRow,
  type StoredFiling,
} from './application/filings.ts';
export { PgFilingRepository } from './infrastructure/pg-filings.ts';
