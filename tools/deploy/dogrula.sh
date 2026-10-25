#!/bin/sh
# `pnpm verify`'ı (tip, mimari, birim testleri, hafıza, ajan senkronu, belge bağlantıları) Node 24 container'ında,
# git geçmişi ve eski/ arşiviyle birlikte çalıştırır — yerel Node sürümünden bağımsız. Depo salt okunur bağlanır.
# Kullanım (depo kökünden): sh tools/deploy/dogrula.sh
set -e
root=$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))
MSYS_NO_PATHCONV=1 docker run --rm -v "$root":/src:ro node:24.11.0-bookworm-slim sh -c '
  set -e; apt-get -qq update >/dev/null && apt-get -qq install -y git >/dev/null
  git config --global --add safe.directory "*"; mkdir /w; cd /src
  tar --exclude=node_modules --exclude=./apps/web/.next --exclude=./test-results -cf - . | tar -xf - -C /w; cd /w
  corepack enable >/dev/null 2>&1; export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
  pnpm install --frozen-lockfile --ignore-scripts >/dev/null
  pnpm -s verify'
