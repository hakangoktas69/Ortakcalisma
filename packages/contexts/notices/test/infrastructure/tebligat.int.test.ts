// Gerçek yığın: e-Tebligat kayıtları işçi tarafından yazılır, ikinci listede yinelenmez, firma kapsamında okunur (kapsam dışı müşavir görmez).
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { GoTrueAuthProvider } from '@eworks/identity-access';
import { ShardRouter } from '@eworks/platform';
import { createFirm, PgFirmRepository, PgTaxpayerRegistry, taxIdHasher } from '@eworks/portfolio';
import { addMember, openOffice, PgDirectory, PgTenantProvisioner } from '@eworks/sales';
import { fakeVkn, yigin } from '@eworks/testing';
import { importNotices, listNotices, PgNoticeRepository } from '../../src/index.ts';

const sistem = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));
const web = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_app'));
const prov = { identity: new GoTrueAuthProvider(yigin.authUrl(), yigin.jwtSecret()), directory: new PgDirectory(sistem), tenant: new PgTenantProvisioner(sistem), newId: randomUUID };
afterAll(async () => {
  await Promise.all([sistem.end(), web.end()]);
});
const kisi = (r: string) => ({ email: `${r}-${randomUUID()}@eworks.test`, password: `Parola-${randomUUID()}`, name: `${r} kişi` });
const liste = (n: number) => ({
  count: n,
  accountVerified: true,
  documentsOpened: false,
  records: Array.from({ length: n }, (_, i) => ({ noticeKey: i.toString(16).padStart(64, 'c'), reference: `B-${i}`, documentType: 'Ödeme Emri', sender: 'VDB', department: '', sentOn: '2026-10-20', deliveredOn: null, readOn: i === 0 ? '2026-10-21' : null })),
});

describe('e-Tebligat (notices.notices)', () => {
  it('[F:tebligat.liste.view] işçi yazar, ikinci liste yinelenmez; firmanın müşaviri görür, kapsam dışı müşavir görmez; web rolü yazamaz', async () => {
    const o = await openOffice({ officeName: `Tebligat ${randomUUID().slice(0, 8)}`, admin: kisi('yonetici') }, prov);
    if (!o.ok) throw new Error(o.error);
    const admin = { sub: o.value.userId, org: o.value.orgId };
    const m2 = await addMember({ orgId: admin.org, role: 'musavir', user: kisi('musavir') }, prov);
    if (!m2.ok) throw new Error(m2.error);
    const firmalar = { repo: new PgFirmRepository(web), registry: new PgTaxpayerRegistry(web), hashTaxId: taxIdHasher(yigin.taxIdKey()), newId: randomUUID };
    const f = await createFirm(admin, { title: 'Tebligat Ltd', kind: 'Limited', taxId: fakeVkn() }, firmalar);
    if (!f.ok) throw new Error(f.error);
    const isci = new PgNoticeRepository(sistem);
    expect(await importNotices({ org: admin.org }, { jobId: randomUUID(), firmId: f.value.id, list: liste(3) }, isci)).toEqual({ ok: true, value: { toplam: 3, yeni: 3, guncellenen: 0 } });
    expect(await importNotices({ org: admin.org }, { jobId: randomUUID(), firmId: f.value.id, list: liste(3) }, isci)).toEqual({ ok: true, value: { toplam: 3, yeni: 0, guncellenen: 3 } });
    const goren = await listNotices(admin, { firmId: f.value.id }, new PgNoticeRepository(web));
    expect(goren.map((n) => [n.reference, n.readOn, n.firmTitle])).toEqual([['B-0', '2026-10-21', 'Tebligat Ltd'], ['B-1', null, 'Tebligat Ltd'], ['B-2', null, 'Tebligat Ltd']]);
    expect(await listNotices({ sub: m2.value.userId, org: admin.org }, {}, new PgNoticeRepository(web))).toEqual([]);
    await expect(new PgNoticeRepository(web).upsert(admin, f.value.id, liste(1).records as never, randomUUID())).rejects.toThrow(/row-level security/);
  });
});
