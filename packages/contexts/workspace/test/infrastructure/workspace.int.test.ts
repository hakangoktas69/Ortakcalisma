// Gerçek yığın: görev/not kapsamı (RLS) — personel atanmadığı firmanın görevini ve notunu görmez, başka ofis görmez,
// personel başkasının görevini güncelleyemez; atama ve kapatma denetim kaydına yazılır.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { GoTrueAuthProvider, PgMembershipReader } from '@eworks/identity-access';
import { createPool, ShardRouter } from '@eworks/platform';
import { createFirm, PgFirmRepository, PgTaxpayerRegistry, taxIdHasher } from '@eworks/portfolio';
import { addMember, openOffice, PgDirectory, PgTenantProvisioner } from '@eworks/sales';
import { fakeVkn, yigin } from '@eworks/testing';
import { addNote, assignTask, changeStatus, createTask, listNotes, listTasks, PgNoteRepository, PgTaskRepository } from '../../src/index.ts';

const sistem = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));
const web = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_app'));
const prov = { identity: new GoTrueAuthProvider(yigin.authUrl(), yigin.jwtSecret()), directory: new PgDirectory(sistem), tenant: new PgTenantProvisioner(sistem), newId: randomUUID };
const firmalar = { repo: new PgFirmRepository(web), registry: new PgTaxpayerRegistry(web), hashTaxId: taxIdHasher(yigin.taxIdKey()), newId: randomUUID };
const uyeOkuyucu = new PgMembershipReader(web);
const d = {
  tasks: new PgTaskRepository(web),
  members: { isStaff: async (c: { sub: string; org: string }, id: string) => (await uyeOkuyucu.staff(c.org, c.sub)).some((m) => m.userId === id) },
};
const notlar = { notes: new PgNoteRepository(web) };
const hepsi = () => true;

afterAll(async () => {
  await Promise.all([sistem.end(), web.end()]);
});

const kisi = (r: string) => ({ email: `${r}-${randomUUID()}@eworks.test`, password: `Parola-${randomUUID()}`, name: `${r} kişi` });

describe('görev ve not kapsamı (workspace)', () => {
  it('personel atanmadığı firmanın görev/notunu görmez, başkasının görevini değiştiremez; başka ofis hiçbirini görmez', async () => {
    const o = await openOffice({ officeName: `Görev ${randomUUID().slice(0, 8)}`, admin: kisi('yonetici') }, prov);
    if (!o.ok) throw new Error(o.error);
    const admin = { sub: o.value.userId, org: o.value.orgId };
    const p = await addMember({ orgId: admin.org, role: 'personel', user: kisi('personel') }, prov);
    if (!p.ok) throw new Error(p.error);
    const personel = { sub: p.value.userId, org: admin.org };
    const f = await createFirm(admin, { title: 'Görev Ltd', kind: 'Limited', taxId: fakeVkn() }, firmalar);
    if (!f.ok) throw new Error(f.error);

    const firmali = await createTask(admin, { title: 'Firma işi', firmId: f.value.id, dueOn: '2026-10-31', assigneeId: null }, hepsi, d);
    const genel = await createTask(admin, { title: 'Ofis işi', firmId: null, dueOn: '2026-10-31', assigneeId: personel.sub }, hepsi, d);
    if (!firmali.ok || !genel.ok) throw new Error('görev');
    expect((await addNote(admin, f.value.id, 'Evrak bekleniyor', notlar)).ok).toBe(true);

    expect((await listTasks(personel, d)).map((t) => t.title)).toEqual(['Ofis işi']);
    expect(await listNotes(personel, notlar)).toEqual([]);
    // Personel kendine atanan görevi ilerletir; yöneticinin kendine aldığı görev ona görünmez → bulunamadı
    expect((await changeStatus(personel, genel.value.id, 1, 'Devam Ediyor', hepsi, d)).ok).toBe(true);
    expect(await changeStatus(personel, firmali.value.id, 1, 'Devam Ediyor', hepsi, d)).toEqual({ ok: false, error: 'bulunamadi' });
    // Personel kapsam dışı firmaya not ekleyemez (RLS)
    await expect(addNote(personel, f.value.id, 'izinsiz', notlar)).rejects.toThrow();

    const b = await openOffice({ officeName: `Başka ${randomUUID().slice(0, 8)}`, admin: kisi('yonetici') }, prov);
    if (!b.ok) throw new Error(b.error);
    const baska = { sub: b.value.userId, org: b.value.orgId };
    expect(await listTasks(baska, d)).toEqual([]);
    expect(await assignTask(baska, genel.value.id, 2, null, d)).toEqual({ ok: false, error: 'bulunamadi' });
    // Başka ofisin kullanıcısına atanmaz
    expect(await assignTask(admin, genel.value.id, 2, baska.sub, d)).toEqual({ ok: false, error: 'uye_degil' });

    expect((await changeStatus(admin, genel.value.id, 2, 'Tamamlandı', hepsi, d)).ok).toBe(true);
    const pool = createPool([...yigin.shardAdminUrls()].find(([id]) => id === 'shard-01')![1], 1);
    const shard = await sistem.shardOf(admin.org);
    const havuz = shard === 'shard-01' ? pool : createPool([...yigin.shardAdminUrls()].find(([id]) => id === shard)![1], 1);
    const { rows } = await havuz.query(`select action from audit.entries where org_id = $1 and action like 'gorev.%' order by id`, [admin.org]);
    expect(rows.map((r) => r.action)).toEqual(['gorev.atandi', 'gorev.kapatildi']);
    await pool.end();
    if (havuz !== pool) await havuz.end();
  });
});
