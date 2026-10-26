import type { ShardRouter } from '@eworks/platform';
import type { Directory, MemberRole, TenantProvisioner } from '../application/provisioning.ts';

// Hesap açmanın kalıcılık adaptörleri: kontrol düzlemi dizini ve ofisin shard'ı. Shard'da tablolara değil yalnız hesap açma
// fonksiyonlarına (sales.open_organization/add_member/is_member) erişilir: satış rolü (eworks_sales) iş verisini göremez,
// hesap açma komutu (eworks_worker) aynı yolu kullanır. Fonksiyonlar ofisin denetim kaydına da yazar.

export class PgDirectory implements Directory {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  leastLoadedShard() {
    return this.router.leastLoadedShard();
  }
  async createOrganization(org: { id: string; name: string; shardId: string }) {
    await this.router.control.query('insert into directory.organizations(id, name, shard_id) values ($1, $2, $3)', [org.id, org.name, org.shardId]);
  }
  async addUserOrg(userId: string, orgId: string) {
    await this.router.control.query('insert into directory.user_orgs(user_id, org_id) values ($1, $2) on conflict do nothing', [userId, orgId]);
  }
  async organizationByName(name: string) {
    const { rows } = await this.router.control.query<{ id: string }>('select id from directory.organizations where lower(name collate "tr-x-icu") = lower($1 collate "tr-x-icu") limit 1', [name]);
    return rows[0] ?? null;
  }
}

export class PgTenantProvisioner implements TenantProvisioner {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  async createOrganization(orgId: string, name: string, by?: string) {
    await (await this.router.poolFor(orgId)).query('select sales.open_organization($1, $2, $3)', [orgId, name, by ?? null]);
  }
  async addMember(orgId: string, m: { userId: string; role: MemberRole; displayName: string; advisorId?: string }, by?: string) {
    await (await this.router.poolFor(orgId)).query('select sales.add_member($1, $2, $3, $4, $5, $6)', [orgId, m.userId, m.role, m.displayName, m.advisorId ?? null, by ?? null]);
  }
  async isMember(orgId: string, userId: string) {
    const { rows } = await (await this.router.poolFor(orgId)).query<{ uye: boolean }>('select sales.is_member($1, $2) as uye', [orgId, userId]);
    return rows[0]?.uye === true;
  }
}
