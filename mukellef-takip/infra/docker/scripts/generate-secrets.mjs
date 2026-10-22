#!/usr/bin/env node
// Docker secrets dosyalarını üretir (infra/docker/secrets/). Var olan dosyaya dokunmaz: tekrar çalıştırmak güvenli.
// Kullanım: node infra/docker/scripts/generate-secrets.mjs
// Dış servis anahtarları (iyzico, WhatsApp, Claude) boş oluşturulur; gerekirse yönetici dosyaya yazar.
// Bu dizin git'e GİRMEZ (.gitignore). Üretimde dizin izinleri yalnız yönetici kullanıcıya açık olmalı (chmod 700).
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'secrets');
mkdirSync(dir, { recursive: true, mode: 0o700 });

const created = [];
const ensure = (name, make) => {
  const path = join(dir, name);
  if (!existsSync(path)) {
    writeFileSync(path, make(), { mode: 0o600 });
    created.push(name);
  }
  return readFileSync(path, 'utf8').trim();
};
// URL'de kaçış gerektirmeyen rastgele parola
const password = () => randomBytes(24).toString('base64url');

ensure('postgres_password', password);
const owner = ensure('owner_password', password);
const app = ensure('app_password', password);
const redis = ensure('redis_password', password);
// Satış modülü (satis/api): ayrı veritabanı rolü, ayrı oturum ve şifreleme anahtarı
const satis = ensure('satis_password', password);
ensure('satis_jwt_secret', () => randomBytes(48).toString('base64url'));
ensure('satis_vault_key', () => randomBytes(32).toString('base64'));
ensure('jwt_secret', () => randomBytes(48).toString('base64url'));
ensure('vault_key', () => randomBytes(32).toString('base64'));
ensure('backup_passphrase', () => randomBytes(32).toString('base64url'));
ensure('database_url', () => `postgresql://mukellef_app:${app}@postgres:5432/mukellef?schema=public`);
ensure('migrate_database_url', () => `postgresql://mukellef_owner:${owner}@postgres:5432/mukellef?schema=public`);
ensure('satis_database_url', () => `postgresql://mukellef_satis:${satis}@postgres:5432/mukellef?schema=public`);
ensure('redis_url', () => `redis://:${redis}@redis:6379`);
for (const optional of ['iyzico_api_key', 'iyzico_secret_key', 'whatsapp_access_token', 'anthropic_api_key', 'openbao_token', 'openbao_wrapped_dek']) {
  ensure(optional, () => '');
}

console.log(created.length ? `Oluşturulan sırlar: ${created.join(', ')}` : 'Bütün sırlar zaten var; hiçbir şey değişmedi.');
