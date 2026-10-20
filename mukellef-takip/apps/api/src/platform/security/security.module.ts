import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

/**
 * İstek hız sınırları (IP başına). Varsayılan: dakikada 300 istek.
 * Daha sıkı sınırlar uçlarda `@Throttle(RATE_LIMITS.auth)` ile verilir.
 */
export const RATE_LIMITS = {
  /** Giriş, 2FA, yenileme: dakikada 10 deneme; aşılırsa 15 dk blok (hesap kilidine ek, IP bazlı) */
  auth: { default: { limit: 10, ttl: 60_000, blockDuration: 15 * 60_000 } },
  /** Dosya/sayfa aktarımı ve yapay zekâ: dakikada 20 */
  heavy: { default: { limit: 20, ttl: 60_000 } },
};

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ name: 'default', limit: 300, ttl: 60_000 }],
        storage: process.env.NODE_ENV === 'test' ? undefined : RedisThrottlerStorage.fromUrl(process.env.REDIS_URL ?? 'redis://localhost:6379'),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class SecurityModule {}
