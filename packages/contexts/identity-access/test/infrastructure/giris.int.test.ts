// Gerçek GoTrue + kontrol düzlemi + shard + Redis: hesap açma → giriş → oturum → RLS ofis sınırı.
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { createPool, ShardRouter, withUser } from '@eworks/platform';
import { openOffice, PgDirectory, PgTenantProvisioner } from '@eworks/sales';
import { yigin } from '@eworks/testing';
import { currentSession, GoTrueAuthProvider, login, PgMembershipReader, RedisSessionStore } from '../../src/index.ts';

const sistem = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));
const web = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_app'));
const auth = new GoTrueAuthProvider(yigin.authUrl(), yigin.jwtSecret());
const redis = new Redis(yigin.redisUrl());
const sessions = new RedisSessionStore(redis, 60);
const provision = { identity: auth, directory: new PgDirectory(sistem), tenant: new PgTenantProvisioner(sistem), newId: randomUUID };
const deps = { auth, members: new PgMembershipReader(web), sessions, ids: { csrf: () => randomUUID() }, clock: { now: () => new Date() } };

afterAll(async () => {
  await Promise.all([sistem.end(), web.end(), redis.quit()]);
});

const yeniOfis = async (ad: string) => {
  const admin = { email: `${randomUUID()}@eworks.test`, password: `Parola-${randomUUID()}`, name: `${ad} yöneticisi` };
  const r = await openOffice({ officeName: `${ad} ${randomUUID().slice(0, 8)}`, admin }, provision);
  if (!r.ok) throw new Error(r.error);
  return { ...r.value, admin };
};

describe('GoTrue ile giriş', () => {
  it('açılan hesapla giriş yapılır, oturum Redis\'te durur; yanlış parola reddedilir', async () => {
    const o = await yeniOfis('Giriş');
    const r = await login({ email: o.admin.email, password: o.admin.password }, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = await currentSession(r.value.sessionId, deps);
    expect(s).toMatchObject({ userId: o.userId, orgId: o.orgId, role: 'ofis_admin' });
    expect(await redis.ttl(`ew:oturum:${r.value.sessionId}`)).toBeGreaterThan(0);
    expect(await login({ email: o.admin.email, password: 'yanlis-parola-xx' }, deps)).toEqual({ ok: false, error: 'kimlik_hatali' });
  });

  it('kendi kendine kayıt kapalı (D27): genel kayıt ucu kullanıcı açmaz', async () => {
    const r = await fetch(`${yigin.authUrl()}/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${randomUUID()}@eworks.test`, password: 'Kayit-parola-12345' }) });
    expect(r.ok).toBe(false);
  });

  it('başka ofisin verisi RLS ile görünmez; etkin ofis claim\'i olmadan kendi ofisi de görünmez', async () => {
    const a = await yeniOfis('A');
    const b = await yeniOfis('B');
    const pool = await web.poolFor(a.orgId);
    const gorunen = await withUser(pool, { sub: a.userId, org: a.orgId }, async (c) => (await c.query('select org_id from identity_access.memberships')).rows.map((x) => x.org_id));
    expect(gorunen).toEqual([a.orgId]);
    const baskasi = await withUser(await web.poolFor(b.orgId), { sub: a.userId, org: b.orgId }, async (c) => (await c.query('select count(*)::int as n from identity_access.memberships')).rows[0].n);
    expect(baskasi).toBe(0);
    const claimsiz = await withUser(pool, { sub: a.userId }, async (c) => (await c.query('select count(*)::int as n from organization.organizations')).rows[0].n);
    expect(claimsiz).toBe(0);
  });

  it('web rolü üyelik yazamaz (yalnız sistem bağlamı)', async () => {
    const a = await yeniOfis('Yazma');
    const pool = await web.poolFor(a.orgId);
    await expect(
      withUser(pool, { sub: a.userId, org: a.orgId }, (c) => c.query(`insert into identity_access.memberships(org_id, user_id, role, display_name) values ($1, $2, 'ofis_admin', 'x')`, [a.orgId, randomUUID()])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('ofis dizini', () => {
  it('ofisler shard\'lara dengeli dağılır', async () => {
    const admin = createPool(yigin.controlAdminUrl(), 1);
    await yeniOfis('Denge');
    await yeniOfis('Denge');
    const { rows } = await admin.query<{ shard_id: string; n: number }>('select shard_id, count(*)::int as n from directory.organizations group by shard_id');
    await admin.end();
    const sayilar = rows.map((r) => r.n);
    expect(rows.length).toBe(2);
    expect(Math.max(...sayilar) - Math.min(...sayilar)).toBeLessThanOrEqual(1);
  });
});
