import { withUser, type ShardRouter } from '@eworks/platform';
import type { Override, Role } from '../domain/permissions.ts';
import type { Membership, MembershipReader } from '../application/ports.ts';

// Kullanıcının ofisleri kontrol düzleminde (directory.user_orgs), rolü ve kişiye özel izinleri ofisin shard'ında.
// Shard okuması kullanıcının kendi claim'leriyle yapılır: RLS yalnız üyesi olduğu ofisi gösterir.

export class PgMembershipReader implements MembershipReader {
  private readonly router: ShardRouter;

  constructor(router: ShardRouter) {
    this.router = router;
  }

  async orgsOf(userId: string) {
    const { rows } = await this.router.control.query<{ orgId: string; name: string }>(
      `select o.id as "orgId", o.name from directory.user_orgs u join directory.organizations o on o.id = u.org_id
        where u.user_id = $1 and o.status = 'active' order by o.name`,
      [userId],
    );
    return rows;
  }

  async staff(orgId: string, userId: string) {
    const pool = await this.router.poolFor(orgId);
    return withUser(pool, { sub: userId, org: orgId }, async (c) =>
      (
        await c.query<{ userId: string; displayName: string; role: Role }>(
          `select user_id as "userId", display_name as "displayName", role from identity_access.memberships
            where org_id = $1 and role <> 'mukellef' order by display_name collate "tr-TR-x-icu"`,
          [orgId],
        )
      ).rows,
    );
  }

  async membership(orgId: string, userId: string): Promise<Membership | null> {
    const pool = await this.router.poolFor(orgId);
    return withUser(pool, { sub: userId, org: orgId }, async (c) => {
      const m = await c.query<{ role: Role; display_name: string }>(
        'select role, display_name from identity_access.memberships where org_id = $1 and user_id = $2',
        [orgId, userId],
      );
      const row = m.rows[0];
      if (!row) return null;
      const o = await c.query<Override>('select key, effect from identity_access.permission_overrides where org_id = $1 and user_id = $2', [orgId, userId]);
      return { role: row.role, displayName: row.display_name, overrides: o.rows };
    });
  }
}
