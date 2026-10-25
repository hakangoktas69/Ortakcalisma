// PUBLIC API — tax-filing bağlamı: e-Beyanname sözleşmeleri, beyannameler, tahakkuklar, son gün kuralları.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/tax-filing.md
export const CONTEXT = 'tax-filing' as const;

export { groupContracts, isIntermediaryContract, type ContractList, type ContractRow, type ListError, type TaxpayerGroup } from './domain/contract-list.ts';
export {
  checkQuery,
  hasSameSessionAccess,
  istanbulDay,
  periodLabel,
  syncScope,
  type DeclarationQuery,
  type DeclarationRecord,
  type DocumentKind,
  type QueryCheck,
} from './domain/declaration.ts';
export {
  importFilingContracts,
  listFilingContracts,
  type ContractRepository,
  type Ctx,
  type FirmPort,
  type FirmRef,
  type ImportSummary,
  type StoredContract,
} from './application/contracts.ts';
export {
  controlMatrix,
  declarationsCsv,
  declarationSummaryText,
  declarationTypes,
  getDeclaration,
  importDeclarations,
  listDeclarations,
  recentPeriods,
  type ControlCell,
  type ControlRow,
  type DeclarationFilter,
  type DeclarationMeta,
  type DeclarationRepository,
  type DeclarationSummary,
  type DocumentPort,
  type StoredDeclaration,
} from './application/declarations.ts';
export { PgContractRepository } from './infrastructure/pg-contracts.ts';
export { PgDeclarationRepository } from './infrastructure/pg-declarations.ts';
