// Gerçek yığın: beyanname + belge kaydı yalnız sistemde (işçi), okuma firma kapsamında (RLS), indirme denetim kaydında,
// saklama süresi dolan dosya S3'ten silinir ve satır işaretlenir (D15).
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { GoTrueAuthProvider } from '@eworks/identity-access';
import { createPool, Depo, ShardRouter } from '@eworks/platform';
import { createFirm, PgFirmRepository, PgTaxpayerRegistry, taxIdHasher } from '@eworks/portfolio';
import { openOffice, PgDirectory, PgTenantProvisioner } from '@eworks/sales';
import { PgDeclarationRepository } from '@eworks/tax-filing';
import { fakeVkn, yigin } from '@eworks/testing';
import { documentsFor, openDocument, PgDocumentRepository, purgeExpired, registerDocuments, S3FileStore, storageKey } from '../../src/index.ts';

const sistem = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));
const web = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_app'));
const prov = { identity: new GoTrueAuthProvider(yigin.authUrl(), yigin.jwtSecret()), directory: new PgDirectory(sistem), tenant: new PgTenantProvisioner(sistem), newId: randomUUID };
const firmalar = { repo: new PgFirmRepository(web), registry: new PgTaxpayerRegistry(web), hashTaxId: taxIdHasher(yigin.taxIdKey()), newId: randomUUID };
const depo = new Depo({ ...yigin.s3(), bucket: 'eworks-test-belgeler', region: 'tr-1' });
const files = new S3FileStore(depo);
const isciBelge = new PgDocumentRepository(sistem);
const webBelge = { repo: new PgDocumentRepository(web), files };

afterAll(async () => {
  await Promise.all([sistem.end(), web.end()]);
});

async function ofisFirmaBeyanname() {
  const o = await openOffice({ officeName: `Belge ${randomUUID().slice(0, 8)}`, admin: { email: `y-${randomUUID()}@eworks.test`, password: `Parola-${randomUUID()}`, name: 'Yönetici' } }, prov);
  if (!o.ok) throw new Error(o.error);
  const ctx = { sub: o.value.userId, org: o.value.orgId };
  const f = await createFirm(ctx, { title: 'Belge Ltd', kind: 'Limited', taxId: fakeVkn() }, firmalar);
  if (!f.ok) throw new Error(f.error);
  const b = await new PgDeclarationRepository(sistem).upsert({ org: ctx.org }, f.value.id, {
    recordId: randomUUID().replaceAll('-', ''), type: 'KDV1', periodStart: '2026-08', periodEnd: '2026-08', uploadedAt: '2026-09-20T10:00:00+03:00',
    taxStatus: 'Onaylandı', sgkStatus: '', branch: '0', reference: 'x.xml', referenceType: 'source_filename', documents: [], documentWarnings: [],
  }, { contractNumbers: ['S-1'], source: 'sahte_gib', jobId: randomUUID() });
  return { ctx, firmId: f.value.id, beyannameId: b.id };
}

describe('belgeler (documents)', () => {
  it('işçi kaydeder; ofis görür ve indirir (denetimli); başka ofis göremez; kullanıcı kayıt ekleyemez', async () => {
    await depo.hazirla();
    const { ctx, firmId, beyannameId } = await ofisFirmaBeyanname();
    const pdf = Buffer.from(`%PDF-1.4\n${'x'.repeat(200)}\n%%EOF\n`);
    const sha = createHash('sha256').update(pdf).digest('hex');
    await depo.koy(storageKey(ctx.org, sha), pdf, 'application/pdf');
    const girdi = { firmId, subjectId: beyannameId, kind: 'declaration', sha256: sha, size: pdf.length, key: storageKey(ctx.org, sha), source: 'sahte_gib' as const, jobId: randomUUID() };
    expect(await registerDocuments({ org: ctx.org }, [girdi], { repo: isciBelge })).toBe(1);
    await expect(registerDocuments(ctx, [girdi], { repo: new PgDocumentRepository(web) })).rejects.toThrow();
    const [b] = await documentsFor(ctx, [beyannameId], webBelge);
    expect(b?.size).toBe(pdf.length);
    const ac = await openDocument(ctx, b!.id, webBelge);
    expect(ac.ok).toBe(true);
    if (ac.ok) expect(Buffer.from(await new Response(ac.body).arrayBuffer()).equals(pdf)).toBe(true);
    const baska = await ofisFirmaBeyanname();
    expect(await openDocument(baska.ctx, b!.id, webBelge)).toEqual({ ok: false, error: 'bulunamadi' });
    const admin = createPool([...yigin.shardAdminUrls()].find(([id]) => id === 'shard-01')![1], 1);
    const shard = await sistem.shardOf(ctx.org);
    const pool = shard === 'shard-01' ? admin : createPool([...yigin.shardAdminUrls()].find(([id]) => id === shard)![1], 1);
    const { rows } = await pool.query(`select count(*)::int as n from audit.entries where org_id = $1 and action = 'belge.indirildi' and subject = $2`, [ctx.org, b!.id]);
    expect(rows[0].n).toBe(1);

    // D15: saklama süresi dolunca dosya silinir, satır kalır
    await pool.query(`update documents.files set stored_at = now() - interval '8 days' where org_id = $1`, [ctx.org]);
    expect(await purgeExpired({ org: ctx.org }, { repo: isciBelge, files }, 7)).toBe(1);
    expect(await depo.akisVarsa(storageKey(ctx.org, sha))).toBeNull();
    expect(await openDocument(ctx, b!.id, webBelge)).toEqual({ ok: false, error: 'dosya_silindi' });
    // Yeniden görülen belge dosyayı yeniden saklar
    await depo.koy(storageKey(ctx.org, sha), pdf, 'application/pdf');
    await registerDocuments({ org: ctx.org }, [girdi], { repo: isciBelge });
    expect((await openDocument(ctx, b!.id, webBelge)).ok).toBe(true);
    await admin.end();
    if (pool !== admin) await pool.end();
  });
});
