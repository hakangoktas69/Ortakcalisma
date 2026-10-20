import { readFileSync } from 'node:fs';
import { z } from 'zod';

// Satış API'sinin ayarları. Müşavir API'sinden AYRI sırlar kullanır: ayrı veritabanı rolü (mukellef_satis),
// ayrı oturum anahtarı ve ayrı şifreleme anahtarı. Biri sızarsa diğer uygulamanın oturumları ve şifreleri etkilenmez.

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL tanımlı değil (satış rolü: mukellef_satis)'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET tanımlı değil'),
  VAULT_KEY: z.string().min(1, 'VAULT_KEY tanımlı değil'),
  // Satış ekranının adresi (CSRF için Origin denetimi), ör. http://localhost:3100 veya https://alanadi
  WEB_ORIGIN: z.string().url().default('http://localhost:3100'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT: z.enum(['on', 'off']).default('on'),
});

export type SatisConfig = z.infer<typeof schema>;

export class ConfigError extends Error {}

/** Docker secrets: X_FILE tanımlıysa X dosyadan okunur (müşavir API'siyle aynı kural). */
export function resolveSecretFiles(env: NodeJS.ProcessEnv) {
  for (const [key, file] of Object.entries(env)) {
    if (!key.endsWith('_FILE') || !file) continue;
    const name = key.slice(0, -'_FILE'.length);
    if (env[name]) continue;
    const value = readFileSync(file, 'utf8').trim();
    if (value) env[name] = value;
  }
}

export function checkSecurity(c: SatisConfig): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = c.NODE_ENV === 'production';
  const problem = (msg: string) => (prod ? errors : warnings).push(msg);
  if (c.JWT_SECRET.length < 32) problem('JWT_SECRET zayıf: en az 32 karakter rastgele bir değer olmalı');
  if (Buffer.from(c.VAULT_KEY, 'base64').length !== 32) errors.push('VAULT_KEY 32 bayt (base64) olmalı');
  if (c.RATE_LIMIT === 'off' && c.NODE_ENV !== 'test') errors.push('RATE_LIMIT=off yalnız test ortamında kullanılabilir');
  if (prod && !c.WEB_ORIGIN.startsWith('https://')) errors.push('Üretimde WEB_ORIGIN https olmalı');
  // Bilinen eksik: üretimde anahtar OpenBao'dan gelmeli (müşavir API'si gibi); satış için henüz yerel anahtar
  if (prod) warnings.push('VAULT_KEY ortam değişkeninden okunuyor; OpenBao entegrasyonu satış modülü için henüz yok');
  return { errors, warnings };
}

let cached: SatisConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SatisConfig {
  resolveSecretFiles(env);
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new ConfigError(`Satış API ayarları geçersiz:\n- ${parsed.error.issues.map((i) => i.message).join('\n- ')}`);
  const { errors, warnings } = checkSecurity(parsed.data);
  for (const w of warnings) console.warn(`[ayar] ${w}`);
  if (errors.length) throw new ConfigError(`Satış API güvensiz ayarla açılmaz:\n- ${errors.join('\n- ')}`);
  cached = parsed.data;
  return parsed.data;
}

/** loadConfig'den sonra (main.ts) uygulama içinden okunur. */
export function config(): SatisConfig {
  if (!cached) throw new ConfigError('Ayarlar yüklenmedi (loadConfig)');
  return cached;
}
