import { createHmac } from 'node:crypto';
import { withUser, type Client, type ShardRouter } from '@eworks/platform';
import type { ValidFirm } from '../domain/firm.ts';
import type { Ctx, Firm, FirmRepository, TaxpayerRegistry } from '../application/firms.ts';

// Firma deposu: ofisin shard'ında, kullanıcı claim'leriyle (RLS app.can_see_firm). VKN dizini: kontrol düzlemi.

const KOLON = `f.id, f.advisor_id as "advisorId", a.title as "advisorName", f.title, f.kind, f.tax_id as "taxId", f.tax_id_kind as "taxIdKind",
  f.tax_office as "taxOffice", f.city, f.representative, f.phone, f.email, f.activity_code as "activityCode", f.activity_name as "activityName",
  f.tax_regime as "taxRegime", f.status, f.group_name as "groupName", f.source, f.archived_at as "archivedAt", f.version, f.updated_at as "updatedAt"`;
const KAYNAK = 'portfolio.firms f join organization.advisors a on a.org_id = f.org_id and a.id = f.advisor_id';

const deger = (f: ValidFirm) => [f.title, f.kind, f.taxId, f.taxIdKind, f.taxOffice, f.city, f.representative, f.phone, f.email, f.activityCode, f.activityName, f.taxRegime, f.status, f.groupName];

export class PgFirmRepository implements FirmRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withUser(await this.router.poolFor(ctx.org), { sub: ctx.sub, org: ctx.org }, fn);
  }
  list(ctx: Ctx, includeArchived: boolean) {
    return this.tx(ctx, async (c) =>
      (await c.query<Firm>(`select ${KOLON} from ${KAYNAK} where f.org_id = $1 ${includeArchived ? '' : 'and f.archived_at is null'} order by f.title collate "tr-TR-x-icu"`, [ctx.org])).rows,
    );
  }
  get(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) => (await c.query<Firm>(`select ${KOLON} from ${KAYNAK} where f.org_id = $1 and f.id = $2`, [ctx.org, id])).rows[0] ?? null);
  }
  myAdvisor(ctx: Ctx) {
    return this.tx(ctx, async (c) => (await c.query<{ a: string | null }>('select app.my_advisor($1) as a', [ctx.org])).rows[0]?.a ?? null);
  }
  async insert(ctx: Ctx, id: string, advisorId: string, f: ValidFirm) {
    await this.tx(ctx, (c) =>
      c.query(
        `insert into portfolio.firms(org_id, id, advisor_id, title, kind, tax_id, tax_id_kind, tax_office, city, representative, phone, email,
           activity_code, activity_name, tax_regime, status, group_name) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [ctx.org, id, advisorId, ...deger(f)],
      ),
    );
  }
  update(ctx: Ctx, id: string, version: number, f: ValidFirm) {
    return this.tx(ctx, async (c) => {
      const r = await c.query(
        `update portfolio.firms set title = $4, kind = $5, tax_id = $6, tax_id_kind = $7, tax_office = $8, city = $9, representative = $10, phone = $11,
           email = $12, activity_code = $13, activity_name = $14, tax_regime = $15, status = $16, group_name = $17, version = version + 1, updated_at = now()
         where org_id = $1 and id = $2 and version = $3 and archived_at is null`,
        [ctx.org, id, version, ...deger(f)],
      );
      if (r.rowCount === 1) return 'ok' as const;
      const var_ = await c.query('select 1 from portfolio.firms where org_id = $1 and id = $2 and archived_at is null', [ctx.org, id]);
      return var_.rowCount === 1 ? ('conflict' as const) : ('not_found' as const);
    });
  }
  async recordExport(ctx: Ctx, count: number) {
    await this.tx(ctx, (c) => c.query(`select audit.record($1, 'firmalar.disa_aktarildi', null, jsonb_build_object('adet', $2::int))`, [ctx.org, count]));
  }
  archive(ctx: Ctx, id: string) {
    return this.tx(ctx, async (c) =>
      (await c.query('update portfolio.firms set archived_at = now(), version = version + 1, updated_at = now() where org_id = $1 and id = $2 and archived_at is null', [ctx.org, id])).rowCount === 1,
    );
  }
}

export class PgTaxpayerRegistry implements TaxpayerRegistry {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  async reserve(hash: string, orgId: string, firmId: string) {
    const r = await this.router.control.query(
      `insert into directory.taxpayer_registry as t (tax_id_hash, org_id, firm_id, state, reserved_until) values ($1, $2, $3, 'reserved', now() + interval '5 minutes')
       on conflict (tax_id_hash) do update set org_id = excluded.org_id, firm_id = excluded.firm_id, state = 'reserved', reserved_until = excluded.reserved_until, updated_at = now()
        where (t.state = 'reserved' and t.reserved_until < now()) or (t.org_id = excluded.org_id and t.firm_id = excluded.firm_id)
       returning 1`,
      [hash, orgId, firmId],
    );
    return r.rowCount === 1 ? ('ok' as const) : ('taken' as const);
  }
  async activate(hash: string, orgId: string, firmId: string) {
    await this.router.control.query(
      `update directory.taxpayer_registry set state = 'active', reserved_until = null, updated_at = now() where tax_id_hash = $1 and org_id = $2 and firm_id = $3`,
      [hash, orgId, firmId],
    );
  }
  async release(hash: string, orgId: string, firmId: string) {
    await this.router.control.query('delete from directory.taxpayer_registry where tax_id_hash = $1 and org_id = $2 and firm_id = $3', [hash, orgId, firmId]);
  }
}

/** VKN/TCKN'nin kendisi kontrol düzlemine yazılmaz; anahtarlı HMAC özeti yazılır (07 §2.2). */
export const taxIdHasher = (key: string) => (taxId: string) => createHmac('sha256', key).update(`eworks:vkn:${taxId}`).digest('hex');
