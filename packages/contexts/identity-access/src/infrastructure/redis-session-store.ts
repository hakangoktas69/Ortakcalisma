import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { Session, SessionStore } from '../application/ports.ts';

// Oturumlar Redis'te (01 §4): tarayıcıya yalnız 256 bit rastgele opak kimlik gider. Her erişimde süre uzar (kayan süre).

const KEY = (id: string) => `ew:oturum:${id}`;

export class RedisSessionStore implements SessionStore {
  private readonly redis: Redis;
  private readonly ttlSeconds: number;

  constructor(redis: Redis, ttlSeconds = 8 * 60 * 60) {
    this.redis = redis;
    this.ttlSeconds = ttlSeconds;
  }

  async create(session: Session): Promise<string> {
    const id = randomBytes(32).toString('base64url');
    await this.redis.set(KEY(id), JSON.stringify(session), 'EX', this.ttlSeconds);
    return id;
  }

  async get(id: string): Promise<Session | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
    const raw = await this.redis.getex(KEY(id), 'EX', this.ttlSeconds);
    return raw ? (JSON.parse(raw) as Session) : null;
  }

  async replace(id: string, session: Session): Promise<void> {
    await this.redis.set(KEY(id), JSON.stringify(session), 'EX', this.ttlSeconds);
  }

  async destroy(id: string): Promise<void> {
    await this.redis.del(KEY(id));
  }
}
