import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import svgCaptcha from 'svg-captcha';
import { CAPTCHA_CHARS, CAPTCHA_LENGTH, CAPTCHA_TTL_SECONDS, captchaMatches } from '../domain/captcha.js';

/**
 * Resimli güvenlik kodu: harfler SVG içinde metin değil çizim (path) olarak üretilir; cevap Redis'te 5 dakika durur
 * ve tek kullanımlıktır (doğrulamada silinir). Dış servis (Google vb.) yok: veri yurt dışına gitmez.
 * CAPTCHA_MODE=off yalnız test ortamında (config.ts).
 */
@Injectable()
export class CaptchaStore implements OnModuleDestroy {
  readonly enabled = process.env.CAPTCHA_MODE !== 'off';
  private redis: Redis | null = null;

  private client() {
    this.redis ??= new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 2 });
    return this.redis;
  }

  async create(): Promise<{ id: string; svg: string }> {
    const c = svgCaptcha.create({ size: CAPTCHA_LENGTH, noise: 3, charPreset: CAPTCHA_CHARS, width: 160, height: 56, fontSize: 52 });
    const id = randomUUID();
    await this.client().set(`captcha:${id}`, c.text, 'EX', CAPTCHA_TTL_SECONDS);
    return { id, svg: c.data };
  }

  /** Tek kullanımlık: doğru da olsa yanlış da olsa kod silinir, yeni kod istenir. */
  async verify(id: string, answer: string): Promise<boolean> {
    const expected = await this.client().getdel(`captcha:${id}`);
    return !!expected && captchaMatches(expected, answer);
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }
}
