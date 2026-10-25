// PUBLIC API — documents bağlamı: PDF metaverisi, saklama, toplu temizlik, yeniden indirme.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/documents.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'documents' as const;

export { DEFAULT_RETENTION_DAYS, DOCUMENT_KINDS, downloadName, KIND_LABEL, retentionDays, storageKey, validDocument, type DocumentKind } from './domain/document.ts';
export {
  documentsFor,
  openDocument,
  purgeExpired,
  registerDocuments,
  type Ctx,
  type DocumentRepository,
  type FileStore,
  type OpenError,
  type RegisterInput,
  type StoredDocument,
  type SubjectKind,
} from './application/documents.ts';
export { PgDocumentRepository, S3FileStore } from './infrastructure/pg-documents.ts';
