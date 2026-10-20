import { readFileSync } from 'node:fs';
import { z } from 'zod';

// Uygulamanın bütün ortam değişkenleri burada tanımlanır ve açılışta doğrulanır.
// Yeni değişken: şemaya ekle + apps/api/.env.example + infra/docker/compose*.yml.
// Ortam değişkenleri yalnız platform/ ve context'lerin infrastructure/ katmanında okunur.

const WEAK_SECRETS = ['degistirin', 'changeme', 'change-me', 'secret', 'password', 'test', 'dev'];
const mode = (values: [string, ...string[]], def: string) => z.enum(values).default(def);

export const configSchema = z.object({
  NODE_ENV: mode(['development', 'test', 'production'], 'development'),
  /** Üretimde demo/mock servislere bilinçli izin (tanıtım kurulumu). Gerçek müşteri verisiyle açılmaz. */
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: mode(['fatal', 'error', 'warn', 'info', 'debug', 'trace'], 'info'),

  LOG_PRETTY: z.enum(['true', 'false']).default('false'),

  /** Uygulama rolüyle bağlantı (RLS'e tabi, tablo sahibi değil). Migration ayrı rolle çalışır. */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL tanımlı değil'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET tanımlı değil'),
  /** Erişim anahtarı ömrü. Web BFF oturumuna geçince (Faz 3) 15m olacak. */
  ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/).default('8h'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(90).default(7),
  API_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(365).default(90),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().default('http://localhost:4000/api'),
  /** Eklentinin Chrome Web Store kimliği; boşsa geliştirmede her eklenti kimliği kabul edilir. */
  EXTENSION_ID: z.string().regex(/^[a-p]{32}$/).optional(),
  /** Caddy gibi bir ters vekilin arkasında: istemci IP'si için X-Forwarded-For'a güvenilecek atlama sayısı */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

  // Anahtar yönetimi (docs/adr/0005)
  KMS_PROVIDER: mode(['local', 'openbao'], 'local'),
  VAULT_KEY: z.string().optional(),
  OPENBAO_ADDR: z.string().optional(),
  OPENBAO_TOKEN: z.string().optional(),
  OPENBAO_TRANSIT_KEY: z.string().default('mukellef'),
  /** OpenBao Transit ile sarılmış veri anahtarı (vault:v1:...). Düz anahtar asla env'de durmaz. */
  OPENBAO_WRAPPED_DEK: z.string().optional(),

  SGK_MODE: mode(['mock', 'live'], 'mock'),
  SGK_VIZITE_URL: z.string().optional(),
  GIB_MODE: mode(['mock', 'live'], 'mock'),
  WHATSAPP_MODE: mode(['off', 'mock', 'live'], 'off'),
  WHATSAPP_GRAPH_VERSION: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_TEMPLATE: z.string().optional(),
  BILLING_PROVIDER: mode(['demo', 'iyzico'], 'demo'),
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().optional(),
  ASSISTANT_MODE: z.enum(['anthropic', 'mock', 'off']).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ASSISTANT_MODEL: z.string().optional(),
  ASSISTANT_WEB_SEARCH: z.enum(['on', 'off']).optional(),
  ASSISTANT_DAILY_LIMIT: z.coerce.number().int().positive().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

export class ConfigError extends Error {}

/**
 * Docker secrets: X_FILE tanımlıysa X'in değeri o dosyadan okunur (ör. JWT_SECRET_FILE=/run/secrets/jwt_secret).
 * Böylece sırlar `docker inspect` çıktısında ve ortam değişkenlerinde görünmez.
 */
export function resolveSecretFiles(env: NodeJS.ProcessEnv) {
  for (const [key, file] of Object.entries(env)) {
    if (!key.endsWith('_FILE') || !file) continue;
    const name = key.slice(0, -'_FILE'.length);
    if (env[name]) continue;
    const value = readFileSync(file, 'utf8').trim();
    // Boş dosya (ör. kullanılmayan sağlayıcı anahtarı) tanımsız sayılır
    if (value) env[name] = value;
  }
}

function isWeak(secret: string) {
  return secret.length < 32 || WEAK_SECRETS.includes(secret.toLowerCase());
}

/** Kurallar: üretimde güvensiz ayarla açılmaz; geliştirmede uyarı verir. */
export function checkSecurity(c: AppConfig): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = c.NODE_ENV === 'production';
  const demo = c.DEMO_MODE === 'true';
  const problem = (msg: string) => (prod ? errors : warnings).push(msg);

  if (isWeak(c.JWT_SECRET)) problem('JWT_SECRET zayıf: en az 32 karakter rastgele bir değer olmalı (openssl rand -base64 48)');
  if (c.KMS_PROVIDER === 'local') {
    if (!c.VAULT_KEY) errors.push('KMS_PROVIDER=local iken VAULT_KEY tanımlı olmalı');
    else if (Buffer.from(c.VAULT_KEY, 'base64').length !== 32) errors.push('VAULT_KEY 32 bayt (base64) olmalı');
    if (prod && !demo) problem('Üretimde KMS_PROVIDER=openbao kullanılmalı (anahtar ortam değişkeninde durmamalı)');
  } else if (!c.OPENBAO_ADDR || !c.OPENBAO_TOKEN || !c.OPENBAO_WRAPPED_DEK) {
    errors.push('KMS_PROVIDER=openbao iken OPENBAO_ADDR, OPENBAO_TOKEN ve OPENBAO_WRAPPED_DEK tanımlı olmalı');
  }
  if (prod) {
    if (!c.WEB_ORIGIN.startsWith('https://')) problem('Üretimde WEB_ORIGIN https olmalı');
    if (!c.API_PUBLIC_URL.startsWith('https://')) problem('Üretimde API_PUBLIC_URL https olmalı');
    // Demo ödeme sağlayıcısı lisansı ücretsiz uzatır: gerçek kurulumda kabul edilmez
    if (c.BILLING_PROVIDER === 'demo' && !demo) errors.push('Üretimde BILLING_PROVIDER=demo kullanılamaz (tanıtım kurulumu için DEMO_MODE=true)');
    if (!c.EXTENSION_ID) warnings.push('EXTENSION_ID tanımlı değil: CORS her Chrome eklentisine açık');
  }
  if (c.BILLING_PROVIDER === 'iyzico' && (!c.IYZICO_API_KEY || !c.IYZICO_SECRET_KEY)) errors.push('BILLING_PROVIDER=iyzico iken IYZICO_API_KEY ve IYZICO_SECRET_KEY tanımlı olmalı');
  if (c.WHATSAPP_MODE === 'live' && (!c.WHATSAPP_ACCESS_TOKEN || !c.WHATSAPP_PHONE_NUMBER_ID)) errors.push('WHATSAPP_MODE=live iken WHATSAPP_ACCESS_TOKEN ve WHATSAPP_PHONE_NUMBER_ID tanımlı olmalı');
  return { errors, warnings };
}

let loaded: AppConfig | null = null;

/**
 * Açılışta bir kez çağrılır (main.ts, worker.ts). Hatalıysa süreç açılmaz.
 * Doğrulanmış varsayılanlar process.env'e de yazılır; altyapı kodu tutarlı değer okur.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, log: (msg: string) => void = console.warn): AppConfig {
  resolveSecretFiles(env);
  // Boş değer (ör. compose'ta ${X:-}) tanımsız sayılır; varsayılan uygulanır
  const parsed = configSchema.safeParse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '')));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(`Ortam ayarları geçersiz:\n${lines.join('\n')}`);
  }
  const { errors, warnings } = checkSecurity(parsed.data);
  for (const w of warnings) log(`[güvenlik uyarısı] ${w}`);
  if (errors.length) throw new ConfigError(`Güvenlik ayarları yetersiz, uygulama açılmadı:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined && env[k] === undefined) env[k] = String(v);
  loaded = parsed.data;
  return loaded;
}

/** loadConfig'ten sonra doğrulanmış ayarlar. */
export function appConfig(): AppConfig {
  if (!loaded) throw new ConfigError('loadConfig() henüz çağrılmadı');
  return loaded;
}
