import { z } from 'zod';

// Ortam değişkenleri açılışta doğrulanır; üretimde zayıf sır ve güvensiz ayarla uygulama açılmaz.
// Her uygulama yalnız ihtiyaç duyduğu bölümü okur (web: oturum + veritabanı; işçi: kuyruk + depo …).

const secret = (min: number) =>
  z.string().min(min, `en az ${min} karakter olmalı`).refine((v) => !/^(changeme|secret|password|sifre|test)$/i.test(v), 'varsayılan değer kullanılamaz');

/** `shard-01=postgres://…,shard-02=postgres://…` biçimi. */
export const parseShardUrls = (raw: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf('=');
    if (i <= 0) throw new Error('SHARD_DATABASE_URLS biçimi: shard-01=postgres://…,shard-02=…');
    out.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  if (out.size === 0) throw new Error('En az bir shard tanımlanmalı');
  return out;
};

export const databaseSchema = z.object({
  CONTROL_DATABASE_URL: z.string().startsWith('postgres'),
  SHARD_DATABASE_URLS: z.string().transform(parseShardUrls),
});

export const sessionSchema = z.object({
  AUTH_URL: z.string().url(),
  JWT_SECRET: secret(32),
  SESSION_SECRET: secret(32),
  REDIS_URL: z.string().startsWith('redis'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  // Ortam açıkça verilir; verilmezse en sıkı mod (üretim). NODE_ENV'e güvenilmez: Next standalone her zaman production'dır.
  EWORKS_ORTAM: z.enum(['gelistirme', 'demo', 'uretim']).default('uretim'),
});

export const messagingSchema = z.object({
  RABBITMQ_URL: z.string().startsWith('amqp'),
});

export const storageSchema = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(3).default('eworks-belgeler'),
  S3_ACCESS_KEY: secret(16),
  S3_SECRET_KEY: secret(16),
  S3_REGION: z.string().default('tr-1'),
});

export type Env = Record<string, string | undefined>;

/** Şemayı doğrular; hata mesajı değişken adlarını verir, değerleri vermez. */
export function loadConfig<S extends z.ZodType>(schema: S, env: Env = process.env): z.infer<S> {
  const r = schema.safeParse(env);
  if (!r.success) {
    const alanlar = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Yapılandırma geçersiz — ${alanlar}`);
  }
  const value = r.data as Record<string, unknown>;
  if ((value['EWORKS_ORTAM'] ?? env['EWORKS_ORTAM'] ?? 'uretim') === 'uretim' && value['COOKIE_SECURE'] === false) {
    throw new Error('Yapılandırma geçersiz — üretimde COOKIE_SECURE=false kullanılamaz');
  }
  return r.data;
}
