import { describe, expect, it } from 'vitest';
import { addMember, openOffice, type ProvisionDeps } from '../../src/index.ts';

function fakes() {
  const users = new Map<string, { id: string; password: string }>();
  const orgs = new Map<string, { name: string; shardId: string }>();
  const members = new Map<string, { role: string; advisorId?: string }>();
  const userOrgs = new Set<string>();
  let n = 0;
  const d: ProvisionDeps = {
    newId: () => `id-${++n}`,
    identity: {
      createUser: async (email, password) => {
        if (users.has(email)) return 'exists';
        const id = `u-${email}`;
        users.set(email, { id, password });
        return { id };
      },
      signIn: async (email, password) => (users.get(email)?.password === password ? { accessToken: email } : null),
      verify: async (t) => ({ id: users.get(t)!.id }),
    },
    directory: {
      leastLoadedShard: async () => 'shard-02',
      createOrganization: async (o) => void orgs.set(o.id, { name: o.name, shardId: o.shardId }),
      addUserOrg: async (u, o) => void userOrgs.add(`${u}@${o}`),
      organizationByName: async (name) => {
        const e = [...orgs].find(([, v]) => v.name === name);
        return e ? { id: e[0] } : null;
      },
    },
    tenant: {
      createOrganization: async () => {},
      addMember: async (o, m) => void members.set(`${m.userId}@${o}`, { role: m.role, ...(m.advisorId ? { advisorId: m.advisorId } : {}) }),
      isMember: async (o, u) => members.has(`${u}@${o}`),
    },
  };
  return { d, users, orgs, members, userOrgs };
}

const admin = { email: 'Yonetici@Eworks.test', password: 'cok-guclu-parola-1', name: 'Yönetici' };

describe('ofis açma (D27)', () => {
  it('en az dolu shard\'a ofis açar; yönetici hem ofis yöneticisi hem müşavirdir; tekrar çalıştırmak çoğaltmaz', async () => {
    const f = fakes();
    const r = await openOffice({ officeName: ' Deneme Ofisi ', admin }, f.d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(f.orgs.get(r.value.orgId)).toEqual({ name: 'Deneme Ofisi', shardId: 'shard-02' });
    expect(f.members.get(`${r.value.userId}@${r.value.orgId}`)).toMatchObject({ role: 'ofis_admin', advisorId: expect.any(String) });
    expect(f.users.has('yonetici@eworks.test')).toBe(true);
    const again = await openOffice({ officeName: 'Deneme Ofisi', admin }, f.d);
    expect(again).toEqual(r);
    expect(f.orgs.size).toBe(1);
    expect(f.members.size).toBe(1);
  });

  it('kısa parola, geçersiz e-posta ya da var olan kullanıcıda farklı parola reddedilir', async () => {
    const f = fakes();
    expect(await openOffice({ officeName: 'X', admin: { ...admin, password: 'kisa' } }, f.d)).toEqual({ ok: false, error: 'gecersiz_bilgi' });
    expect(await openOffice({ officeName: 'X', admin: { ...admin, email: 'gecersiz' } }, f.d)).toEqual({ ok: false, error: 'gecersiz_bilgi' });
    await openOffice({ officeName: 'X', admin }, f.d);
    expect(await openOffice({ officeName: 'Y', admin: { ...admin, password: 'baska-guclu-parola' } }, f.d)).toEqual({ ok: false, error: 'kullanici_var_parola_farkli' });
    // Kullanıcı açılamadıysa ofis de açılmaz (yarım ofis kalmaz)
    expect(f.orgs.size).toBe(1);
  });

  it('personel ofise müşavir kaydı olmadan eklenir', async () => {
    const f = fakes();
    const o = await openOffice({ officeName: 'X', admin }, f.d);
    if (!o.ok) throw new Error();
    const r = await addMember({ orgId: o.value.orgId, role: 'personel', user: { email: 'p@eworks.test', password: 'personel-parola-1', name: 'P' } }, f.d);
    expect(r.ok).toBe(true);
    if (r.ok) expect(f.members.get(`${r.value.userId}@${o.value.orgId}`)).toEqual({ role: 'personel' });
  });
});
