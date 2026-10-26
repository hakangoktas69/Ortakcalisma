# Node imajları (web, satış portalı, worker, migrate, test koşucusu) — tek Dockerfile, hedef (target) ile seçilir (04 §1).
# Bağımlılıklar kilit dosyasından; kaynak .ts olarak çalışır (Node 24 tip ayıklama), web Next.js ile derlenir.
FROM node:24.11.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile --ignore-scripts

# Test koşucusu: birim + entegrasyon (Compose ağında veritabanlarına bağlanır) + pgTAP
FROM deps AS ci
CMD ["sh", "-c", "pnpm test:yigin"]

# İşçi ve migration: ayrıcalıksız kullanıcı, salt kaynak
FROM deps AS worker
USER node
CMD ["node", "apps/worker/src/main.ts"]

# Web (Next.js standalone): derleme ayrı aşamada, çalışma imajında yalnız standalone çıktı
FROM deps AS web-build
RUN pnpm --filter @eworks/web build

FROM node:24.11.0-bookworm-slim AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=web-build --chown=node /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# Satış portalı (D27, D40): ayrı imaj, aynı kalıp
FROM deps AS sales-build
RUN pnpm --filter @eworks/sales-portal build

FROM node:24.11.0-bookworm-slim AS sales
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=sales-build --chown=node /app/apps/sales/.next/standalone ./
COPY --from=sales-build --chown=node /app/apps/sales/.next/static ./apps/sales/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/sales/server.js"]

# Arayüz kabul testleri (Playwright, 4 ekran) — yığının ağında web'e ve satış portalına karşı koşar; biri kırmızıysa koşu kırmızı
FROM mcr.microsoft.com/playwright:v1.64.1-noble AS e2e
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY --from=deps /app /app
CMD ["sh", "-c", "pnpm --filter @eworks/web exec playwright test; w=$?; pnpm --filter @eworks/sales-portal exec playwright test; s=$?; exit $((w|s))"]
