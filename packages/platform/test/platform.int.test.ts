// Gerçek yığına karşı: migration'lar uygulanmış, shard yönlendirme ve rol/RLS bağlamı doğru (D34).
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { yigin } from '@eworks/testing';
import { createPool, ShardRouter, UnknownOrganizationError, withSystem, withUser } from '../src/index.ts';

const adminControl = createPool(yigin.controlAdminUrl(), 2);
const router = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_app'));
const worker = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));

afterAll(async () => {
  await Promise.all([adminControl.end(), router.end(), worker.end()]);
});

describe('migration ve shard dizini', () => {
  it('her shard ve kontrol düzlemi migration kaydı taşır', async () => {
    for (const [id, url] of yigin.shardAdminUrls()) {
      const p = createPool(url, 1);
      const { rows } = await p.query<{ n: number }>('select count(*)::int as n from migrations.applied');
      expect(rows[0]!.n, id).toBeGreaterThan(0);
      await p.end();
    }
    const { rows } = await adminControl.query<{ id: string }>('select id from directory.shards order by id');
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining(['shard-01', 'shard-02']));
  });

  it("ofisin shard'ını dizinden bulur, bilinmeyen ofiste hata verir", async () => {
    const org = randomUUID();
    const shard = await router.leastLoadedShard();
    await router.control.query('insert into directory.organizations(id, name, shard_id) values ($1, $2, $3)', [org, 'Test ofisi', shard]);
    expect(await router.shardOf(org)).toBe(shard);
    await expect(router.shardOf(randomUUID())).rejects.toBeInstanceOf(UnknownOrganizationError);
  });
});

describe('veritabanı bağlamı', () => {
  const org = randomUUID();
  const sub = randomUUID();

  it('kullanıcı bağlamı claim\'leri işleme yazar, işlem bitince düşer', async () => {
    const pool = router.pool('shard-01');
    const r = await withUser(pool, { sub, org }, async (c) => (await c.query('select app.uid() as u, app.active_org() as o, current_user as r')).rows[0]);
    expect(r).toEqual({ u: sub, o: org, r: 'authenticated' });
    const after = await pool.query(`select current_setting('request.jwt.claims', true) as c, current_user as r`);
    expect(after.rows[0]).toEqual({ c: '', r: 'eworks_app' });
    // İşlem dışında giriş rolü RLS yardımcılarına bile erişemez
    await expect(pool.query('select app.uid()')).rejects.toThrow(/permission denied/);
  });

  it('sistem bağlamı yalnız işçi rolünde geçerli; web rolü taklit edemez', async () => {
    const asWorker = await withSystem(worker.pool('shard-01'), org, async (c) => (await c.query('select app.is_system($1) as s', [org])).rows[0].s);
    const asWeb = await withSystem(router.pool('shard-01'), org, async (c) => (await c.query('select app.is_system($1) as s', [org])).rows[0].s);
    const otherOrg = await withSystem(worker.pool('shard-01'), org, async (c) => (await c.query('select app.is_system($1) as s', [randomUUID()])).rows[0].s);
    expect([asWorker, asWeb, otherOrg]).toEqual([true, false, false]);
  });

  it('giriş rolü rol değiştirmeden şemaya erişemez', async () => {
    await expect(router.pool('shard-01').query('select * from migrations.applied')).rejects.toThrow(/permission denied/);
  });
});
