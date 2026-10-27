import { err, ok, type Result } from '@eworks/kernel';
import { withCtx, type Client, type ShardRouter } from '@eworks/platform';
import type { Consent, ConsentMethod, ConsentRepository, Ctx } from '../application/consent.ts';

// Mükellef onayı deposu: yazma yalnız tanımlayıcı fonksiyonlarla (yetki + denetim kaydı aynı işlemde); okuma firma kapsamında (RLS).
// Kapsam dışı firma (42501) ve olmayan firma (23503) bilinen durumlardır; diğer hatalar sınırda (BFF) ele alınır.

export class PgConsentRepository implements ConsentRepository {
  private readonly router: ShardRouter;
  constructor(router: ShardRouter) {
    this.router = router;
  }
  private async tx<T>(ctx: Ctx, fn: (c: Client) => Promise<T>) {
    return withCtx(await this.router.poolFor(ctx.org), ctx, fn);
  }
  private async yaz(ctx: Ctx, sql: string, p: unknown[], olmazsa: boolean): Promise<Result<void, 'yetki_yok' | 'bulunamadi'>> {
    try {
      const sonuc = await this.tx(ctx, async (c) => (await c.query<{ r: boolean }>(sql, p)).rows[0]?.r);
      return olmazsa && sonuc === false ? err('bulunamadi') : ok(undefined);
    } catch (e) {
      const kod = (e as { code?: string }).code;
      if (kod === '42501') return err('yetki_yok');
      if (kod === '23503') return err('bulunamadi');
      throw e;
    }
  }
  record(ctx: Ctx, firmId: string, method: ConsentMethod, consentedOn: string) {
    return this.yaz(ctx, 'select credentials.record_consent($1, $2, $3, $4::date) as r', [ctx.org, firmId, method, consentedOn], false);
  }
  revoke(ctx: Ctx, firmId: string) {
    return this.yaz(ctx, 'select credentials.revoke_consent($1, $2) as r', [ctx.org, firmId], true);
  }
  status(ctx: Ctx, firmId: string) {
    return this.tx(ctx, async (c) => {
      const r = await c.query<Omit<Consent, 'recordedAt'> & { recordedAt: Date }>(
        `select firm_id as "firmId", method, to_char(consented_on, 'YYYY-MM-DD') as "consentedOn", recorded_at as "recordedAt", revoked_at is null as active
           from credentials.consents where org_id = $1 and firm_id = $2 order by (revoked_at is null) desc, recorded_at desc limit 1`,
        [ctx.org, firmId],
      );
      const k = r.rows[0];
      return k ? { ...k, recordedAt: k.recordedAt.toISOString() } : null;
    });
  }
}
