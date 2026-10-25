import { err, ok } from '@eworks/kernel';
import { withUser, type ShardRouter } from '@eworks/platform';
import type { AccountStatus, CredentialRepository, Ctx, SaveInput } from '../application/accounts.ts';

// Kayıt yalnız credentials.save_account() ile (tanımlayıcı hakları: Vault + denetim kaydı). Web rolü Vault şemasını göremez.

const HATA: Record<string, 'yetki_yok' | 'gecersiz' | 'bulunamadi'> = { '42501': 'yetki_yok', '22023': 'gecersiz', P0002: 'bulunamadi' };

export class PgCredentialRepository implements CredentialRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  async save(ctx: Ctx, i: SaveInput) {
    try {
      const id = await withUser(await this.router.poolFor(ctx.org), ctx, async (c) => {
        const r = await c.query<{ r: { accountId: string } }>('select credentials.save_account($1, $2, $3, $4, $5, $6) as r', [ctx.org, i.ownerKind, i.ownerId, i.institution, i.username, i.password]);
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
  async statuses(ctx: Ctx) {
    return withUser(await this.router.poolFor(ctx.org), ctx, async (c) =>
      (
        await c.query<AccountStatus>(
          `select id, owner_kind as "ownerKind", owner_id as "ownerId", institution, status, updated_at as "updatedAt", last_success_at as "lastSuccessAt"
             from credentials.institution_accounts where org_id = $1`,
          [ctx.org],
        )
      ).rows,
    );
  }
}
