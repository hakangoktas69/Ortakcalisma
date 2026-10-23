// tax-filing (beyanname, e-Defter) context'inin public API'si.
export { TaxFilingModule } from './tax-filing.module.js';
export { DeclarationsService } from './application/declarations.service.js';
export { EDefterService, defaultBeratMonth } from './application/edefter.service.js';
export { DECLARATION_INFO, parseControlMonth, periodLabel } from './domain/declaration-rules.js';
/** Tebligat ayrıştırıcısı beyanname tablolarını ayırt etmek için kullanır. */
export { mapHeaders as mapDeclarationHeaders } from './infrastructure/declaration-table-parser.js';
