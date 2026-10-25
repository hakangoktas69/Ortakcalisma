// Gerçek yığın: VKN tekilliği (kontrol düzlemi, ofisler arası), RLS kapsamı (müşavir/personel/başka ofis), kurum hesabı Vault'u, denetim zinciri.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PgCredentialRepository, saveAccount, accountStatuses } from '@eworks/credentials';
import { GoTrueAuthProvider } from '@eworks/identity-access';
import { createPool, ShardRouter, withUser } from '@eworks/platform';
import { addMember, openOffice, PgDirectory, PgTenantProvisioner } from '@eworks/sales';
import { fakeVkn, yigin } from '@eworks/testing';
import { archiveFirm, createFirm, getFirm, listFirms, PgFirmRepository, PgTaxpayerRegistry, taxIdHasher } from '../../src/index.ts';

const sistem = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));
const web = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_app'));
const auth = new GoTrueAuthProvider(yigin.authUrl(), yigin.jwtSecret());
const prov = { identity: auth, directory: new PgDirectory(sistem), tenant: new PgTenantProvisioner(sistem), newId: randomUUID };
const deps = { repo: new PgFirmRepository(web), registry: new PgTaxpayerRegistry(web), hashTaxId: taxIdHasher(yigin.taxIdKey()), newId: randomUUID };
const creds = new PgCredentialRepository(web);

afterAll(async () => {
  await Promise.all([sistem.end(), web.end()]);
});

const kullanici = (rol: string) => ({ email: `${rol}-${randomUUID()}@eworks.test`, password: `Parola-${randomUUID()}`, name: `${rol} kişi` });
async function ofis() {
  const o = await openOffice({ officeName: `Portföy ${randomUUID().slice(0, 8)}`, admin: kullanici('yonetici') }, prov);
  if (!o.ok) throw new Error(o.error);
  const uye = async (role: 'musavir' | 'personel') => {
    const r = await addMember({ orgId: o.value.orgId, role, user: kullanici(role) }, prov);
    if (!r.ok) throw new Error(r.error);
    return { sub: r.value.userId, org: o.value.orgId };
  };
  return { admin: { sub: o.value.userId, org: o.value.orgId }, uye };
}

describe('VKN tekilliği (kontrol düzlemi)', () => {
  it('aynı VKN başka ofiste aktifken eklenemez; arşivlenince serbest kalır', async () => {
    const [a, b] = [await ofis(), await ofis()];
    const vkn = fakeVkn();
    const ilk = await createFirm(a.admin, { title: 'Ortak Ltd', kind: 'Limited', taxId: vkn }, deps);
    expect(ilk.ok).toBe(true);
    expect(await createFirm(b.admin, { title: 'Ortak Ltd', kind: 'Limited', taxId: vkn }, deps)).toEqual({ ok: false, error: 'vkn_kayitli' });
    if (ilk.ok) expect((await archiveFirm(a.admin, ilk.value.id, deps)).ok).toBe(true);
    expect((await createFirm(b.admin, { title: 'Ortak Ltd', kind: 'Limited', taxId: vkn }, deps)).ok).toBe(true);
  });

  it('kontrol düzlemine VKN\'nin kendisi değil HMAC özeti yazılır', async () => {
    const a = await ofis();
    const vkn = fakeVkn();
    await createFirm(a.admin, { title: 'Özet Ltd', kind: 'Limited', taxId: vkn }, deps);
    const admin = createPool(yigin.controlAdminUrl(), 1);
    const { rows } = await admin.query(`select count(*)::int as n from directory.taxpayer_registry where tax_id_hash like '%' || $1 || '%'`, [vkn]);
    await admin.end();
    expect(rows[0].n).toBe(0);
  });
});

describe('kapsam (RLS, 05 §3.2)', () => {
  it('müşavir yalnız kendi portföyünü görür; ofis yöneticisi hepsini; personel atanmadıkça hiçbirini; başka ofis hiçbirini', async () => {
    const a = await ofis();
    const m1 = await a.uye('musavir');
    const m2 = await a.uye('musavir');
    const p = await a.uye('personel');
    const f1 = await createFirm(m1, { title: 'M1 firması', kind: 'Limited', taxId: fakeVkn() }, deps);
    const f2 = await createFirm(m2, { title: 'M2 firması', kind: 'Limited', taxId: fakeVkn() }, deps);
    if (!f1.ok || !f2.ok) throw new Error('firma');
    expect((await listFirms(m1, {}, deps)).map((f) => f.title)).toEqual(['M1 firması']);
    expect((await listFirms(a.admin, {}, deps)).map((f) => f.title).sort()).toEqual(['M1 firması', 'M2 firması']);
    expect(await listFirms(p, {}, deps)).toEqual([]);
    expect(await getFirm(m2, f1.value.id, deps)).toBeNull();
    const b = await ofis();
    expect(await getFirm({ ...b.admin }, f1.value.id, deps)).toBeNull();
    // Personel ataması (yönetim ekranı henüz yok): atanınca görür
    const pool = createPool([...yigin.shardAdminUrls()].find(([id]) => id === 'shard-01')![1], 1);
    const shard = await sistem.shardOf(a.admin.org);
    const pool2 = shard === 'shard-01' ? pool : createPool([...yigin.shardAdminUrls()].find(([id]) => id === shard)![1], 1);
    await pool2.query('insert into portfolio.staff_assignments(org_id, user_id, firm_id, assigned_by) values ($1, $2, $3, $4)', [a.admin.org, p.sub, f1.value.id, a.admin.sub]);
    expect((await listFirms(p, {}, deps)).map((f) => f.title)).toEqual(['M1 firması']);
    await pool.end();
    if (pool2 !== pool) await pool2.end();
  });

  it('müşavir başka müşavir adına firma ekleyemez; personel firma ekleyemez (RLS)', async () => {
    const a = await ofis();
    const m1 = await a.uye('musavir');
    const p = await a.uye('personel');
    const baskaMusavir = await withUser(await web.poolFor(a.admin.org), a.admin, async (c) => (await c.query('select app.my_advisor($1) as a', [a.admin.org])).rows[0].a);
    await expect(createFirm(m1, { title: 'Başkası adına', kind: 'Limited', taxId: fakeVkn(), advisorId: baskaMusavir }, deps)).rejects.toThrow(/row-level security/);
    expect(await createFirm(p, { title: 'Personel', kind: 'Limited', taxId: fakeVkn() }, deps)).toEqual({ ok: false, error: 'musavir_yok' });
  });
});

describe('kurum hesabı (Vault)', () => {
  it('kaydedilir, durum görünür; şifre hiçbir yoldan okunamaz; denetim kaydı zincirlidir ve şifre içermez', async () => {
    const a = await ofis();
    const f = await createFirm(a.admin, { title: 'Hesaplı Ltd', kind: 'Limited', taxId: fakeVkn() }, deps);
    if (!f.ok) throw new Error();
    const sifre = `Gizli-${randomUUID()}`;
    expect((await saveAccount(a.admin, { ownerKind: 'firm', ownerId: f.value.id, institution: 'GIB', username: '1234567', password: sifre }, creds)).ok).toBe(true);
    expect((await saveAccount(a.admin, { ownerKind: 'firm', ownerId: f.value.id, institution: 'GIB', username: '1234567', password: `${sifre}-2` }, creds)).ok).toBe(true);
    const durum = await accountStatuses(a.admin, creds, { kind: 'firm', id: f.value.id });
    expect(durum).toHaveLength(1);
    expect(durum[0]).toMatchObject({ status: 'active', institution: 'GIB' });
    expect(JSON.stringify(durum)).not.toContain(sifre);
    const pool = await web.poolFor(a.admin.org);
    await expect(withUser(pool, a.admin, (c) => c.query('select decrypted_secret from vault.decrypted_secrets'))).rejects.toThrow(/permission denied/);
    await expect(withUser(pool, a.admin, (c) => c.query('select secret_id from credentials.institution_accounts'))).rejects.toThrow(/permission denied/);
    const kayitlar = await withUser(pool, a.admin, async (c) => (await c.query('select action, details::text as d, prev_hash, hash from audit.entries where org_id = $1 order by id', [a.admin.org])).rows);
    const hesap = kayitlar.filter((k) => k.action === 'kurum_hesabi.kaydedildi');
    expect(hesap).toHaveLength(2);
    expect(hesap[1].prev_hash).toBe(hesap[0].hash);
    expect(JSON.stringify(kayitlar)).not.toContain(sifre);
  });

  it('personel ve başka müşavir firmanın hesabını giremez; kayıt yetkisi DB\'de de denetlenir', async () => {
    const a = await ofis();
    const m1 = await a.uye('musavir');
    const m2 = await a.uye('musavir');
    const p = await a.uye('personel');
    const f = await createFirm(m1, { title: 'M1 Ltd', kind: 'Limited', taxId: fakeVkn() }, deps);
    if (!f.ok) throw new Error();
    const g = { ownerKind: 'firm' as const, ownerId: f.value.id, institution: 'GIB' as const, username: 'k', password: 'p' };
    expect(await saveAccount(m2, g, creds)).toEqual({ ok: false, error: 'yetki_yok' });
    expect(await saveAccount(p, g, creds)).toEqual({ ok: false, error: 'yetki_yok' });
    expect((await saveAccount(m1, g, creds)).ok).toBe(true);
  });
});
