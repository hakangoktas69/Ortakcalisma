import { Readable } from 'node:stream';
import { withCtx, type Client, type Depo, type ShardRouter } from '@eworks/platform';
import type { DocumentKind } from '../domain/document.ts';
import type { Ctx, DocumentRepository, FileStore, RegisterInput, StoredDocument } from '../application/documents.ts';

const KOLON = `id, firm_id as "firmId", subject_id as "subjectId", kind, sha256, size, storage_key as "storageKey",
  stored_at as "storedAt", file_deleted_at as "fileDeletedAt"`;

export class PgDocumentRepository implements DocumentRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, fn);
  }
  async upsert(ctx: Ctx, d: RegisterInput & { kind: DocumentKind }) {
    await this.tx(ctx, (c) =>
      c.query(
        `insert into documents.files(org_id, firm_id, subject_kind, subject_id, kind, sha256, size, storage_key, source, created_by_job)
         values ($1, $2, 'declaration', $3, $4, $5, $6, $7, $8, $9)
         on conflict (org_id, subject_id, kind, sha256) do update set stored_at = now(), file_deleted_at = null`,
        [ctx.org, d.firmId, d.subjectId, d.kind, d.sha256, d.size, d.key, d.source, d.jobId],
      ),
    );
  }
  forSubjects(ctx: Ctx, ids: readonly string[]) {
    return this.tx(ctx, async (c) =>
      (await c.query<StoredDocument>(`select ${KOLON} from documents.files where org_id = $1 and subject_id = any($2::uuid[]) order by kind, stored_at desc`, [ctx.org, ids])).rows,
    );
  }
  get(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) => (await c.query<StoredDocument>(`select ${KOLON} from documents.files where org_id = $1 and id = $2`, [ctx.org, id])).rows[0] ?? null);
  }
  async recordDownload(ctx: Ctx, id: string) {
    await this.tx(ctx, (c) => c.query(`select audit.record($1, 'belge.indirildi', $2, '{}'::jsonb)`, [ctx.org, id]));
  }
  expiredKeys(ctx: Ctx, days: number, limit: number) {
    return this.tx(ctx, async (c) =>
      (
        await c.query<{ k: string }>(
          `select storage_key as k from documents.files where org_id = $1 and file_deleted_at is null
            group by storage_key having max(stored_at) < now() - make_interval(days => $2) limit $3`,
          [ctx.org, days, limit],
        )
      ).rows.map((r) => r.k),
    );
  }
  markDeleted(ctx: Ctx, keys: readonly string[], days: number) {
    return this.tx(ctx, async (c) => {
      const r = await c.query(
        `update documents.files set file_deleted_at = now() where org_id = $1 and storage_key = any($2::text[]) and file_deleted_at is null
            and stored_at < now() - make_interval(days => $3)`,
        [ctx.org, keys, days],
      );
      if (r.rowCount) await c.query(`select audit.record($1, 'belge.saklama_suresi_doldu', null, jsonb_build_object('adet', $2::int))`, [ctx.org, r.rowCount]);
      return r.rowCount ?? 0;
    });
  }
}

/** S3 dosya deposu: belge gövdesi web akışı olarak döner (bellekte tamponlanmaz). */
export class S3FileStore implements FileStore {
  private readonly depo: Depo;
  constructor(depo: Depo) {
    this.depo = depo;
  }
  async stream(key: string) {
    const r = await this.depo.akisVarsa(key);
    return r ? (Readable.toWeb(r.govde) as ReadableStream<Uint8Array>) : null;
  }
  deleteMany(keys: readonly string[]) {
    return this.depo.topluSil(keys);
  }
}
