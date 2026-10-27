import { err, ok } from '@eworks/kernel';
import { withCtx, type ShardRouter } from '@eworks/platform';
import type { AccountStatus, CredentialRepository, Ctx, StoredSecret } from '../application/accounts.ts';

// Kayıt yalnız credentials.save_account_secret() ile (tanımlayıcı hakları: Vault + denetim kaydı). Web rolü Vault şemasını göremez.

const HATA: Record<string, 'yetki_yok' | 'gecersiz' | 'bulunamadi'> = { '42501': 'yetki_yok', '22023': 'gecersiz', P0002: 'bulunamadi' };

export class PgCredentialRepository implements CredentialRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  async save(ctx: Ctx, i: StoredSecret) {
    try {
      const id = await withCtx(await this.router.poolFor(ctx.org), ctx, async (c) => {
        const r = await c.query<{ r: { accountId: string } }>('select credentials.save_account_secret($1, $2, $3, $4, $5, $6) as r', [ctx.org, i.ownerKind, i.ownerId, i.institution, i.label, JSON.stringify(i.secret)]);
        return r.rows[0]!.r.accountId;
      });
      return ok({ accountId: id });
    } catch (e) {
      const kod = (e as { code?: string }).code ?? '';
      if (HATA[kod]) return err(HATA[kod]!);
      // Hata metni şifre içerebilecek parametreleri yansıtmasın diye yeniden sarılır
      throw new Error('Kurum hesabı kaydedilemedi');
    }
  }
  async recordLogin(ctx: Ctx, accountId: string, outcome: 'ok' | 'wrong_password') {
    await withCtx(await this.router.poolFor(ctx.org), ctx, (c) =>
      outcome === 'ok'
        ? c.query(`update credentials.institution_accounts set last_success_at = now(), consecutive_failures = 0 where org_id = $1 and id = $2`, [ctx.org, accountId])
        : c.query(`update credentials.institution_accounts set status = 'wrong_password', consecutive_failures = consecutive_failures + 1 where org_id = $1 and id = $2`, [ctx.org, accountId]),
    );
  }
  async statuses(ctx: Ctx) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, async (c) =>
      (
        await c.query<Omit<AccountStatus, 'updatedAt' | 'lastSuccessAt'> & { updatedAt: Date; lastSuccessAt: Date | null }>(
          `select id, owner_kind as "ownerKind", owner_id as "ownerId", institution, label, status, updated_at as "updatedAt", last_success_at as "lastSuccessAt"
             from credentials.institution_accounts where org_id = $1 order by institution, label`,
          [ctx.org],
        )
      ).rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString(), lastSuccessAt: r.lastSuccessAt?.toISOString() ?? null })),
    );
  }
}
