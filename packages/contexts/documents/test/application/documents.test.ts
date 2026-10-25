import { describe, expect, it } from 'vitest';
import { downloadName, openDocument, purgeExpired, registerDocuments, retentionDays, storageKey, type DocumentRepository, type StoredDocument } from '../../src/index.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const ctx = { org: ORG };
const sha = 'b'.repeat(64);

function depo(belgeler: StoredDocument[] = []) {
  const eklenen: string[] = [];
  const indirilen: string[] = [];
  const silinmis = new Set<string>();
  const anahtarlar = ['k1', 'k2', 'k3'];
  const repo: DocumentRepository = {
    upsert: async (_c, d) => void eklenen.push(d.key),
    forSubjects: async () => belgeler,
    get: async (_c, id) => belgeler.find((b) => b.id === id) ?? null,
    recordDownload: async (_c, id) => void indirilen.push(id),
    expiredKeys: async (_c, _g, limit) => anahtarlar.filter((k) => !silinmis.has(k)).slice(0, limit),
    markDeleted: async (_c, keys) => {
      keys.forEach((k) => silinmis.add(k));
      return keys.length;
    },
  };
  return { repo, eklenen, indirilen, silinmis };
}

const belge = (o: Partial<StoredDocument> = {}): StoredDocument => ({
  id: 'd-1',
  firmId: 'f',
  subjectKind: 'declaration',
  subjectId: 's',
  kind: 'declaration',
  sha256: sha,
  size: 500,
  storageKey: storageKey(ORG, sha),
  storedAt: '',
  fileDeletedAt: null,
  ...o,
});

describe('belgeler', () => {
  it('yalnız ofise ait, biçimi doğru belge kaydedilir', async () => {
    const { repo, eklenen } = depo();
    const t = { firmId: 'f', subjectId: 's', source: 'gib_live' as const, jobId: 'j', kind: 'declaration', sha256: sha, size: 500, key: storageKey(ORG, sha) };
    const n = await registerDocuments(ctx, [t, { ...t, key: storageKey('22222222-2222-4222-8222-222222222222', sha) }, { ...t, kind: 'xml' }, { ...t, size: 50 }], { repo });
    expect(n).toBe(1);
    expect(eklenen).toEqual([storageKey(ORG, sha)]);
  });

  it('açma denetim kaydı bırakır; süresi dolmuş ya da kapsam dışı belge açılmaz', async () => {
    const { repo, indirilen } = depo([belge(), belge({ id: 'd-2', fileDeletedAt: '2026-10-01' })]);
    const files = { stream: async () => new ReadableStream<Uint8Array>(), deleteMany: async () => {} };
    expect((await openDocument(ctx, 'd-1', { repo, files })).ok).toBe(true);
    expect(await openDocument(ctx, 'd-2', { repo, files })).toEqual({ ok: false, error: 'dosya_silindi' });
    expect(await openDocument(ctx, 'yok', { repo, files })).toEqual({ ok: false, error: 'bulunamadi' });
    expect(await openDocument(ctx, 'd-1', { repo, files: { ...files, stream: async () => null } })).toEqual({ ok: false, error: 'dosya_silindi' });
    expect(indirilen).toEqual(['d-1']);
  });

  it('saklama temizliği parça parça siler ve işaretler (D15)', async () => {
    const { repo, silinmis } = depo();
    const silinen: string[][] = [];
    expect(await purgeExpired(ctx, { repo, files: { stream: async () => null, deleteMany: async (k) => void silinen.push([...k]) } }, 7, 2)).toBe(3);
    expect(silinen).toEqual([['k1', 'k2'], ['k3']]);
    expect(silinmis.size).toBe(3);
  });

  it('saklama süresi parametresi ve kişisel veri içermeyen dosya adı', () => {
    expect(retentionDays(undefined)).toBe(7);
    expect(retentionDays('30')).toBe(30);
    expect(retentionDays('0')).toBe(7);
    expect(downloadName('tax_accrual', 'KDV1', '2026-08')).toBe('KDV1-2026-08-tahakkuk.pdf');
  });
});
