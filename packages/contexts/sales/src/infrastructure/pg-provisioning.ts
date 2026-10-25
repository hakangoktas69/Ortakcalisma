import { withSystem, type ShardRouter } from '@eworks/platform';
import type { Directory, MemberRole, TenantProvisioner } from '../application/provisioning.ts';

// Hesap açmanın kalıcılık adaptörleri: kontrol düzlemi dizini (eworks_control) ve ofisin shard'ı (işçi rolü, sistem bağlamı).

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
    const { rows } = await this.router.control.query<{ id: string }>('select id from directory.organizations where name = $1 limit 1', [name]);
    return rows[0] ?? null;
  }
}

export class PgTenantProvisioner implements TenantProvisioner {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  async createOrganization(orgId: string, name: string) {
    await withSystem(await this.router.poolFor(orgId), orgId, (c) =>
      c.query('insert into organization.organizations(id, name) values ($1, $2) on conflict (id) do nothing', [orgId, name]),
    );
  }
  async addMember(orgId: string, m: { userId: string; role: MemberRole; displayName: string; advisorId?: string }) {
    await withSystem(await this.router.poolFor(orgId), orgId, async (c) => {
      await c.query('insert into identity_access.memberships(org_id, user_id, role, display_name) values ($1, $2, $3, $4)', [orgId, m.userId, m.role, m.displayName]);
      if (m.advisorId) {
        await c.query('insert into organization.advisors(org_id, id, user_id, title) values ($1, $2, $3, $4)', [orgId, m.advisorId, m.userId, m.displayName]);
      }
    });
  }
  async isMember(orgId: string, userId: string) {
    return withSystem(await this.router.poolFor(orgId), orgId, async (c) =>
      (await c.query('select 1 from identity_access.memberships where org_id = $1 and user_id = $2', [orgId, userId])).rowCount === 1,
    );
  }
}
