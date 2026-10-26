import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { LockPort } from '../application/offices.ts';
import type { SalesSessionData, SalesSessionStore } from '../application/sales-auth.ts';

// Satış oturumları ve ara adımlar Redis'te (portal oturumlarından ayrı önek). Tarayıcıya yalnız 256 bit opak kimlik gider.
// Oturum her erişimde süresini uzatmaz: ara adım kısa ömürlüdür, satış oturumu 8 saatte biter (kayan süre yok).
// Sayaç, güvenlik kodu ve kilit atomiktir (INCR, GETDEL, SET NX, Lua karşılaştır-sil): paralel istekler sınırları aşamaz, başkasının kilidini silemez.

const KEY = (id: string) => `ew:satis:oturum:${id}`;
const DENEME = (id: string) => `ew:satis:oturum:${id}:deneme`;
const KOD = (id: string) => `ew:satis:oturum:${id}:kod`;
const KILIT = (k: string) => `ew:satis:kilit:${k}`;
/** Ara adımın ömrü (5 dk); deneme sayacı adımdan önce düşmesin. */
const DENEME_SURESI = 5 * 60;

const OTURUM_TURLERI = new Set(['baslangic', 'adim', 'oturum']);

export class RedisSalesSessionStore implements SalesSessionStore {
  private readonly redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }
  async create(data: SalesSessionData, ttlSeconds: number) {
    const id = randomBytes(32).toString('base64url');
    await this.redis.set(KEY(id), JSON.stringify(data), 'EX', ttlSeconds);
    return id;
  }
  async get(id: string): Promise<SalesSessionData | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
    const raw = await this.redis.get(KEY(id));
    if (!raw) return null;
    try {
      const v: unknown = JSON.parse(raw);
      return typeof v === 'object' && v !== null && 'kind' in v && OTURUM_TURLERI.has(String(v.kind)) ? (v as SalesSessionData) : null;
    } catch {
      return null;
    }
  }
  /** Süreyi koruyarak içeriği değiştirir (parola değişince yeni sürüm). */
  async replace(id: string, data: SalesSessionData) {
    await this.redis.set(KEY(id), JSON.stringify(data), 'KEEPTTL');
  }
  async destroy(id: string) {
    await this.redis.del(KEY(id), DENEME(id), KOD(id));
  }
  async setCaptcha(id: string, text: string, ttlSeconds: number) {
    await this.redis.set(KOD(id), text, 'EX', ttlSeconds);
  }
  /** GETDEL: yanıt okununca silinir (tek kullanımlık; paralel iki istekte yalnız biri alır). */
  takeCaptcha(id: string) {
    return this.redis.getdel(KOD(id));
  }
  async incrementAttempts(id: string) {
    const sonuc = await this.redis.multi().incr(DENEME(id)).expire(DENEME(id), DENEME_SURESI).exec();
    // İşlem yürütülemezse sınır aşılmış say (fail-closed): adım düşer
    return Number(sonuc?.[0]?.[1] ?? Number.MAX_SAFE_INTEGER);
  }
}

// Kilidi yalnız jetonu tutan bırakır (süresi dolup başkasına geçmiş kilit silinmez)
const BIRAK = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export class RedisLocks implements LockPort {
  private readonly redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }
  async acquire(key: string, ttlSeconds: number) {
    const jeton = randomBytes(16).toString('base64url');
    return (await this.redis.set(KILIT(key), jeton, 'EX', ttlSeconds, 'NX')) === 'OK' ? jeton : null;
  }
  async release(key: string, token: string) {
    await this.redis.eval(BIRAK, 1, KILIT(key), token);
  }
}
