#!/usr/bin/env node
// Yerelde `npm run dev:api` için apps/api/.env satırlarını yazdırır (Docker'daki postgres/redis'e 127.0.0.1'den bağlanır).
// Uygulama RLS'e tabi rolle, migration tablo sahibiyle çalışır. Yalnız geliştirme sırlarıdır.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'secrets');
const s = (n) => readFileSync(join(dir, n), 'utf8').trim();
const local = (url) => url.replace('@postgres:', '@127.0.0.1:').replace('@redis:', '@127.0.0.1:');
console.log(`# apps/api/.env (yalnız geliştirme)
DATABASE_URL="${local(s('database_url'))}"
# Migration ve seed tablo sahibi rolüyle: DATABASE_URL="$MIGRATE_DATABASE_URL" npx prisma migrate deploy
MIGRATE_DATABASE_URL="${local(s('migrate_database_url'))}"
REDIS_URL="${local(s('redis_url'))}"
JWT_SECRET="${s('jwt_secret')}"
VAULT_KEY="${s('vault_key')}"
WEB_ORIGIN="http://localhost:3000"
SGK_MODE="mock"
GIB_MODE="mock"
WHATSAPP_MODE="mock"
BILLING_PROVIDER="demo"
ASSISTANT_MODE="mock"
LOG_PRETTY="true"`);
