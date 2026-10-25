#!/bin/sh
# pnpm-lock.yaml'ı Node 24 container'ında günceller (yerel Node sürümünden bağımsız). Yalnız kilit dosyası geri yazılır.
# Kullanım (depo kökünden): sh tools/deploy/kilit.sh
set -e
root=$(cd "$(dirname "$0")/../.." && (pwd -W 2>/dev/null || pwd))
MSYS_NO_PATHCONV=1 docker run --rm -v "$root":/src node:24.11.0-bookworm-slim sh -c '
  set -e; mkdir /w; cd /src
  tar --exclude=./eski --exclude=./.git --exclude=node_modules --exclude=./apps/web/.next -cf - . | tar -xf - -C /w
  cd /w; corepack enable >/dev/null 2>&1; export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  pnpm install --ignore-scripts --lockfile-only >/dev/null
  cp pnpm-lock.yaml /src/pnpm-lock.yaml; echo "✔ pnpm-lock.yaml güncellendi"'
