import { err, ok, type Result } from '@eworks/kernel';

// Ofis ve kullanıcı açma (D27: hesaplar satış portalından açılır, kendi kendine kayıt yok). Satış portalı ekranı yapılana
// kadar bu use-case'i `apps/worker/src/hesap-ac.ts` komutu çağırır; satis.* özellikleri bu yüzden kırmızıdır.
// Sıra: shard seç → kontrol düzleminde ofis → kimlik (GoTrue) → shard'da ofis, müşavir, üyelik → kullanıcının ofis dizini.

export type MemberRole = 'ofis_admin' | 'musavir' | 'personel' | 'mukellef';

export interface Identity {
  createUser(email: string, password: string, name: string): Promise<{ id: string } | 'exists'>;
  signIn(email: string, password: string): Promise<{ accessToken: string } | null>;
  verify(accessToken: string): Promise<{ id: string } | null>;
}

export interface Directory {
  leastLoadedShard(): Promise<string>;
  createOrganization(org: { id: string; name: string; shardId: string }): Promise<void>;
  addUserOrg(userId: string, orgId: string): Promise<void>;
  organizationByName(name: string): Promise<{ id: string } | null>;
}

export interface TenantProvisioner {
  createOrganization(orgId: string, name: string): Promise<void>;
  addMember(orgId: string, m: { userId: string; role: MemberRole; displayName: string; advisorId?: string }): Promise<void>;
  isMember(orgId: string, userId: string): Promise<boolean>;
}

export type ProvisionDeps = { identity: Identity; directory: Directory; tenant: TenantProvisioner; newId: () => string };

export type NewUser = { email: string; password: string; name: string };

const validUser = (u: NewUser) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email) && u.password.length >= 12 && u.name.trim().length > 0;

/** Kullanıcıyı açar ya da (aynı parolayla) var olanı bulur — tekrarlanabilir hesap açma için. */
async function userId(u: NewUser, d: ProvisionDeps): Promise<string | null> {
  const created = await d.identity.createUser(u.email.toLowerCase(), u.password, u.name.trim());
  if (created !== 'exists') return created.id;
  const t = await d.identity.signIn(u.email.toLowerCase(), u.password);
  return t ? ((await d.identity.verify(t.accessToken))?.id ?? null) : null;
}

export type ProvisionError = 'gecersiz_bilgi' | 'kullanici_var_parola_farkli';

/** Yeni ofis + yöneticisi (aynı zamanda müşavir: portföy sahibi olabilsin). Ofis adı mevcutsa onu kullanır. */
export async function openOffice(input: { officeName: string; admin: NewUser }, d: ProvisionDeps): Promise<Result<{ orgId: string; userId: string }, ProvisionError>> {
  if (!input.officeName.trim() || !validUser(input.admin)) return err('gecersiz_bilgi');
  let orgId = (await d.directory.organizationByName(input.officeName.trim()))?.id;
  if (!orgId) {
    orgId = d.newId();
    const shardId = await d.directory.leastLoadedShard();
    await d.directory.createOrganization({ id: orgId, name: input.officeName.trim(), shardId });
    await d.tenant.createOrganization(orgId, input.officeName.trim());
  }
  const uid = await userId(input.admin, d);
  if (!uid) return err('kullanici_var_parola_farkli');
  if (!(await d.tenant.isMember(orgId, uid))) {
    await d.tenant.addMember(orgId, { userId: uid, role: 'ofis_admin', displayName: input.admin.name.trim(), advisorId: d.newId() });
    await d.directory.addUserOrg(uid, orgId);
  }
  return ok({ orgId, userId: uid });
}

/** Var olan ofise kullanıcı ekler (müşavir kaydı yalnız müşavir ve ofis yöneticisi için açılır). */
export async function addMember(input: { orgId: string; user: NewUser; role: MemberRole }, d: ProvisionDeps): Promise<Result<{ userId: string }, ProvisionError>> {
  if (!validUser(input.user)) return err('gecersiz_bilgi');
  const uid = await userId(input.user, d);
  if (!uid) return err('kullanici_var_parola_farkli');
  if (!(await d.tenant.isMember(input.orgId, uid))) {
    const advisor = input.role === 'musavir' || input.role === 'ofis_admin';
    await d.tenant.addMember(input.orgId, { userId: uid, role: input.role, displayName: input.user.name.trim(), ...(advisor ? { advisorId: d.newId() } : {}) });
    await d.directory.addUserOrg(uid, input.orgId);
  }
  return ok({ userId: uid });
}
