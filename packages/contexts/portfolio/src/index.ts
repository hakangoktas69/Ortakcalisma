// PUBLIC API — portfolio bağlamı: mükellef kartı, müşavir bağı (tek müşavir), mükellef kullanıcıları, devir.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/portfolio.md
export const CONTEXT = 'portfolio' as const;

export { FIRM_KINDS, FIRM_STATUSES, firmCategory, inSegment, isApproved, TAX_REGIMES, validateFirm, type FirmFieldError, type ValidFirm } from './domain/firm.ts';
export { matchesSearch, normalizeSearch, searchRank } from './domain/search.ts';
export {
  archiveFirm,
  createFirm,
  createFirmFromSource,
  firmsByTaxIds,
  refreshFirmFromSource,
  exportFirms,
  firmsCsv,
  getFirm,
  listFirms,
  myAdvisorId,
  updateFirm,
  type Ctx,
  type Firm,
  type FirmDeps,
  type FirmError,
  type FirmFilter,
  type FirmInput,
  type FirmKind,
  type FirmRepository,
  type FirmStatus,
  type Segment,
  type TaxpayerRegistry,
  type TaxRegime,
} from './application/firms.ts';
export { PgFirmRepository, PgTaxpayerRegistry, taxIdHasher } from './infrastructure/pg-firms.ts';
