#!/bin/sh
# Migration container'ı: şemayı günceller; SEED_DEMO=true ise ve veritabanı boşsa demo verisini yükler.
# Tablo sahibi rolüyle (mukellef_owner) çalışır; uygulama süreçleri bu role erişmez.
set -eu

if [ -n "${MIGRATE_DATABASE_URL_FILE:-}" ]; then
  DATABASE_URL="$(cat "$MIGRATE_DATABASE_URL_FILE")"
  export DATABASE_URL
fi
if [ -n "${VAULT_KEY_FILE:-}" ] && [ -z "${VAULT_KEY:-}" ]; then
  VAULT_KEY="$(cat "$VAULT_KEY_FILE")"
  export VAULT_KEY
fi

npx prisma migrate deploy

if [ "${SEED_DEMO:-false}" = "true" ]; then
  EMPTY=$(node -e "
    const pg = require('pg');
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    c.connect().then(() => c.query('SELECT count(*)::int AS n FROM \"Tenant\"')).then(r => { console.log(r.rows[0].n === 0 ? 'yes' : 'no'); return c.end(); });
  ")
  if [ "$EMPTY" = "yes" ]; then
    echo "Veritabanı boş: demo verisi yükleniyor"
    npx tsx prisma/seed.ts
  else
    echo "Veritabanında veri var: demo verisi yüklenmedi"
  fi
fi
