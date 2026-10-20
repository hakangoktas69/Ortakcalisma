import type { OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

// Sayaç ve blok süresini tek atomik adımda yönetir (birden fazla API kopyası aynı sayaçları paylaşır).
const SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl <= 0 and hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blockTtl = tonumber(ARGV[3])
end
return { hits, ttl, blockTtl }
`;

/** @nestjs/throttler için Redis deposu (bellek içi depo tek süreçte kalır, ölçeklenmez). */
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  constructor(private readonly redis: Redis) {}

  static fromUrl(url: string) {
    return new RedisThrottlerStorage(new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: true }));
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const base = `throttle:${throttlerName}:${key}`;
    const [hits, ttlMs, blockMs] = (await this.redis.eval(SCRIPT, 2, base, `${base}:block`, ttl, limit, blockDuration || ttl)) as [number, number, number];
    const isBlocked = blockMs > 0;
    return {
      totalHits: hits,
      timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockMs / 1000) : 0,
    };
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
