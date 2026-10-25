// Entegrasyon testleri için yığın adresleri (TEST_* ortamı; `node tools/deploy/yigin.mjs test` verir).
// Ortam eksikse test sessizce atlanmaz: açık bir hatayla durur.

/** `shard-01=url,shard-02=url` → Map (platform'a bağımlı olmamak için burada; biçim platform/config ile aynı). */
const parseShardUrls = (raw: string) => new Map(raw.split(',').filter(Boolean).map((p) => [p.slice(0, p.indexOf('=')).trim(), p.slice(p.indexOf('=') + 1).trim()] as const));

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} tanımlı değil — entegrasyon testlerini 'node tools/deploy/yigin.mjs test' ile çalıştırın`);
  return v;
};

/** Yönetici URL'sindeki kullanıcı/parolayı uygulama rolüyle değiştirir (rol parolaları migrate'te atanmıştır). */
export const asRole = (adminUrl: string, role: string, password: string) => {
  const u = new URL(adminUrl);
  u.username = role;
  u.password = password;
  return u.toString();
};

export const yigin = {
  controlAdminUrl: () => need('TEST_CONTROL_URL'),
  shardAdminUrls: () => parseShardUrls(need('TEST_SHARD_URLS')),
  controlUrl: () => asRole(need('TEST_CONTROL_URL'), 'eworks_control', need('TEST_CONTROL_DB_PASSWORD')),
  shardUrls: (role: 'eworks_app' | 'eworks_worker' | 'eworks_integration') => {
    const pw = need(role === 'eworks_app' ? 'TEST_APP_DB_PASSWORD' : role === 'eworks_worker' ? 'TEST_WORKER_DB_PASSWORD' : 'TEST_INTEGRATION_DB_PASSWORD');
    return new Map([...parseShardUrls(need('TEST_SHARD_URLS'))].map(([id, url]) => [id, asRole(url, role, pw)]));
  },
  redisUrl: () => need('TEST_REDIS_URL'),
  rabbitUrl: () => need('TEST_RABBITMQ_URL'),
  s3: () => ({ endpoint: need('TEST_S3_ENDPOINT'), accessKey: need('TEST_S3_ACCESS_KEY'), secretKey: need('TEST_S3_SECRET_KEY') }),
  authUrl: () => need('TEST_AUTH_URL'),
  jwtSecret: () => need('TEST_JWT_SECRET'),
  webUrl: () => need('TEST_WEB_URL'),
  fakeGibUrl: () => need('TEST_FAKE_GIB_URL'),
};
