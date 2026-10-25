import { validDocument, type DocumentKind, type NewDocument } from '../domain/document.ts';

// Belge use-case'leri. Kayıt işçide (sistem bağlamı), listeleme ve indirme kullanıcı bağlamında (RLS: firma kapsamı).
// İndirme denetim kaydına yazılır. Saklama temizliği işçide, ofis başına parçalı.

export type Ctx = { readonly sub?: string; readonly org: string };

export type SubjectKind = 'declaration' | 'sgk_filing';

export type StoredDocument = {
  id: string;
  firmId: string;
  subjectKind: SubjectKind;
  subjectId: string;
  kind: DocumentKind;
  sha256: string;
  size: number;
  storageKey: string;
  storedAt: string;
  fileDeletedAt: string | null;
};

export type RegisterInput = NewDocument & { firmId: string; subjectKind?: SubjectKind; subjectId: string; source: 'gib_live' | 'sahte_gib'; jobId: string };

export interface DocumentRepository {
  /** Yoksa ekler; varsa dosyayı yeniden saklanmış sayar (stored_at, file_deleted_at = null). */
  upsert(ctx: Ctx, d: RegisterInput & { kind: DocumentKind }): Promise<void>;
  forSubjects(ctx: Ctx, subjectIds: readonly string[]): Promise<StoredDocument[]>;
  get(ctx: Ctx, id: string): Promise<StoredDocument | null>;
  recordDownload(ctx: Ctx, id: string): Promise<void>;
  /** Süresi dolmuş, hâlâ saklanan anahtarlar (anahtarı kullanan tüm satırlar süresi dolmuşsa). */
  expiredKeys(ctx: Ctx, olderThanDays: number, limit: number): Promise<string[]>;
  markDeleted(ctx: Ctx, keys: readonly string[], olderThanDays: number): Promise<number>;
}

export interface FileStore {
  stream(key: string): Promise<ReadableStream<Uint8Array> | null>;
  deleteMany(keys: readonly string[]): Promise<void>;
}

/** İşçi: ACL'in yazdığı belgeleri kaydeder. Anahtarı ofise ait olmayan ya da biçimi bozuk belge atlanır. Kayıtlı sayıyı döner. */
export async function registerDocuments(ctx: Ctx, docs: readonly RegisterInput[], d: { repo: DocumentRepository }): Promise<number> {
  let n = 0;
  for (const x of docs) {
    if (!validDocument(ctx.org, x)) continue;
    await d.repo.upsert(ctx, x);
    n++;
  }
  return n;
}

export const documentsFor = (ctx: Ctx, subjectIds: readonly string[], d: { repo: DocumentRepository }) =>
  subjectIds.length ? d.repo.forSubjects(ctx, subjectIds) : Promise.resolve([]);

export type OpenError = 'bulunamadi' | 'dosya_silindi';

/** Kullanıcı: belgeyi açar (kapsam dışı → bulunamadı). Saklama süresi dolmuşsa dosya yok (D15). Her açış denetim kaydına. */
export async function openDocument(
  ctx: Ctx,
  id: string,
  d: { repo: DocumentRepository; files: FileStore },
): Promise<{ ok: true; doc: StoredDocument; body: ReadableStream<Uint8Array> } | { ok: false; error: OpenError }> {
  const doc = await d.repo.get(ctx, id);
  if (!doc) return { ok: false, error: 'bulunamadi' };
  if (doc.fileDeletedAt) return { ok: false, error: 'dosya_silindi' };
  const body = await d.files.stream(doc.storageKey);
  if (!body) return { ok: false, error: 'dosya_silindi' };
  await d.repo.recordDownload(ctx, id);
  return { ok: true, doc, body };
}

/** İşçi: süresi dolan dosyaları parça parça siler, satırları işaretler (02 §9). Silinen dosya sayısını döner. */
export async function purgeExpired(ctx: Ctx, d: { repo: DocumentRepository; files: FileStore }, days: number, batch = 1000): Promise<number> {
  let total = 0;
  for (;;) {
    const keys = await d.repo.expiredKeys(ctx, days, batch);
    if (keys.length === 0) return total;
    await d.files.deleteMany(keys);
    await d.repo.markDeleted(ctx, keys, days);
    total += keys.length;
    if (keys.length < batch) return total;
  }
}
