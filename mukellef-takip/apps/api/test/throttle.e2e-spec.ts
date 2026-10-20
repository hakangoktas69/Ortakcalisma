import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestApp, bootApp } from './support/app.js';

// Hız sınırı regresyonu: kaba kuvvet denemeleri 429 ile kesilir (bu dosyada sınır AÇIK).
let t: TestApp;
beforeAll(async () => {
  t = await bootApp({ RATE_LIMIT: 'on' });
}, 120_000);
afterAll(() => t?.close());

describe('hız sınırı', () => {
  it('girişte dakikada 10 denemeden sonra 429 döner ve blok sürer', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await t.http().post('/api/auth/login').send({ email: 'yok@mukellef.test', password: 'x' })).status);
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
  });

  it('sağlık ucu sınırdan muaf', async () => {
    for (let i = 0; i < 20; i++) await t.http().get('/api/health').expect(200);
  });
});

describe('Redis hız sınırı deposu (birden fazla API kopyası ortak sayaç)', () => {
  it('sayar, sınırı aşınca bloklar ve süreyi raporlar; iki kopya aynı sayacı görür', async () => {
    const { RedisThrottlerStorage } = await import('../src/platform/security/redis-throttler.storage.js');
    const { stack } = await import('./support/app.js');
    const a = RedisThrottlerStorage.fromUrl(stack().redisUrl);
    const b = RedisThrottlerStorage.fromUrl(stack().redisUrl);
    const key = `test-${Date.now()}`;
    try {
      const r1 = await a.increment(key, 60_000, 2, 30_000, 'default');
      const r2 = await b.increment(key, 60_000, 2, 30_000, 'default');
      expect([r1.totalHits, r2.totalHits]).toEqual([1, 2]);
      expect(r2.isBlocked).toBe(false);
      const r3 = await a.increment(key, 60_000, 2, 30_000, 'default');
      expect(r3).toMatchObject({ totalHits: 3, isBlocked: true });
      expect(r3.timeToBlockExpire).toBeGreaterThan(0);
      expect(r3.timeToExpire).toBeGreaterThan(0);
    } finally {
      await a.onModuleDestroy();
      await b.onModuleDestroy();
    }
  });
});
