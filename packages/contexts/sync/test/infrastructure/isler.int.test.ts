// Gerçek yığın: iş + outbox tek işlemde, RLS (başka ofis görmez), rol sınırları (outbox yalnız işçi, iş sahiplenme ve
// kurum sırrı yalnız entegrasyon rolü), iş yalnız bir kez sahiplenilir, sonuç kesindir.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PgCredentialRepository, saveAccount, accountStatuses } from '@eworks/credentials';
import { GoTrueAuthProvider } from '@eworks/identity-access';
import { createPool, ShardRouter, withSystem } from '@eworks/platform';
import { myAdvisorId, PgFirmRepository } from '@eworks/portfolio';
import { openOffice, PgDirectory, PgTenantProvisioner } from '@eworks/sales';
import { yigin } from '@eworks/testing';
import { finishJob, getJob, PgJobRepository, requestJob } from '../../src/index.ts';

const sistem = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));
const web = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_app'));
const prov = { identity: new GoTrueAuthProvider(yigin.authUrl(), yigin.jwtSecret()), directory: new PgDirectory(sistem), tenant: new PgTenantProvisioner(sistem), newId: randomUUID };
const webIsler = { jobs: new PgJobRepository(web), newId: randomUUID };
const isciIsler = { jobs: new PgJobRepository(sistem) };
const creds = new PgCredentialRepository(web);
const entegrasyonUrl = async (org: string) => yigin.shardUrls('eworks_integration').get(await sistem.shardOf(org))!;

afterAll(async () => {
  await Promise.all([sistem.end(), web.end()]);
});

async function ofisVeHesap() {
  const o = await openOffice({ officeName: `Senkron ${randomUUID().slice(0, 8)}`, admin: { email: `y-${randomUUID()}@eworks.test`, password: `Parola-${randomUUID()}`, name: 'Yönetici' } }, prov);
  if (!o.ok) throw new Error(o.error);
  const ctx = { sub: o.value.userId, org: o.value.orgId };
  const musavir = await myAdvisorId(ctx, { repo: new PgFirmRepository(web) });
  if (!musavir) throw new Error('müşavir yok');
  const h = await saveAccount(ctx, { ownerKind: 'advisor', ownerId: musavir, institution: 'GIB', fields: { username: '55500001', password: 'sahte-sifre' } }, creds);
  if (!h.ok) throw new Error(h.error);
  const [hesap] = await accountStatuses(ctx, creds);
  return { ctx, hesap: hesap! };
}

describe('kurum işi (sync)', () => {
  it('iş ve outbox mesajı birlikte yazılır; outbox yalnız işçiye görünür; başka ofis işi görmez', async () => {
    const { ctx, hesap } = await ofisVeHesap();
    const r = await requestJob(ctx, { kind: 'gib.sozlesmeler', account: hesap }, webIsler);
    if (!r.ok) throw new Error(r.error);
    expect((await getJob(ctx, r.value.jobId, webIsler))?.status).toBe('queued');
    const baska = await ofisVeHesap();
    expect(await getJob(baska.ctx, r.value.jobId, webIsler)).toBeNull();
    // Uygulama rolü outbox'ı okuyamaz
    const appPool = web.pool(await web.shardOf(ctx.org));
    await expect(withSystem(appPool, ctx.org, (c) => c.query('select * from sync.pending_outbox(10)'))).rejects.toThrow();
    // Yığındaki işçi outbox'ı sürekli yayımlar: mesaj bu satıra gelmeden "yayımlandı" olabilir. Önce bekleyenler, sonra satır
    // okunur: bekleyenlerde yoksa yayımlanmış olmalı (yayımlanmış mesaj geri bekleyene dönmez; sıra yarışa dayanıklı).
    const { bekleyen, yazilan } = await withSystem(sistem.pool(await sistem.shardOf(ctx.org)), ctx.org, async (c) => {
      const b = (await c.query<{ org_id: string; payload: { jobId: string } }>('select * from sync.pending_outbox(500)')).rows
        .some((m) => m.org_id === ctx.org && m.payload.jobId === r.value.jobId);
      const y = (await c.query<{ payload: { jobId: string }; published_at: Date | null }>(
        'select payload, published_at from sync.outbox where org_id = $1', [ctx.org])).rows.find((m) => m.payload.jobId === r.value.jobId);
      return { bekleyen: b, yazilan: y };
    });
    expect(yazilan).toBeDefined(); // iş ile aynı işlemde yazıldı
    if (!bekleyen) expect(yazilan?.published_at).not.toBeNull();
  });

  it('iş bir kez sahiplenilir; kurum sırrı yalnız entegrasyon rolüne ve yalnız sahiplenilmiş işe verilir', async () => {
    const { ctx, hesap } = await ofisVeHesap();
    const r = await requestJob(ctx, { kind: 'gib.sozlesmeler', account: hesap }, webIsler);
    if (!r.ok) throw new Error(r.error);
    const ent = createPool(await entegrasyonUrl(ctx.org), 1);
    try {
      expect((await ent.query('select sync.claim_job($1, $2) as j', [ctx.org, r.value.jobId])).rows[0].j).not.toBeNull();
      expect((await ent.query('select sync.claim_job($1, $2) as j', [ctx.org, r.value.jobId])).rows[0].j).toBeNull();
      const sir = (await ent.query('select credentials.secret_for_job($1, $2) as s', [ctx.org, r.value.jobId])).rows[0].s;
      expect(sir).toEqual({ username: '55500001', password: 'sahte-sifre' });
      // Uygulama rolü sırrı okuyamaz
      const app = web.pool(await web.shardOf(ctx.org));
      await expect(app.query('select credentials.secret_for_job($1, $2)', [ctx.org, r.value.jobId])).rejects.toThrow();
      expect((await getJob(ctx, r.value.jobId, webIsler))?.status).toBe('running');
      expect(await finishJob({ org: ctx.org }, r.value.jobId, 'succeeded', 'tamam', isciIsler)).toBe(true);
      expect(await finishJob({ org: ctx.org }, r.value.jobId, 'failed', 'geç', isciIsler)).toBe(false);
      expect((await getJob(ctx, r.value.jobId, webIsler))?.status).toBe('succeeded');
    } finally {
      await ent.end();
    }
  });

  it('kullanıcı iş durumunu kendisi değiştiremez (sonuç yalnız işçiden)', async () => {
    const { ctx, hesap } = await ofisVeHesap();
    const r = await requestJob(ctx, { kind: 'gib.sozlesmeler', account: hesap }, webIsler);
    if (!r.ok) throw new Error(r.error);
    expect(await finishJob(ctx, r.value.jobId, 'failed', 'kullanıcı', webIsler)).toBe(false);
    expect((await getJob(ctx, r.value.jobId, webIsler))?.status).toBe('queued');
  });
});
