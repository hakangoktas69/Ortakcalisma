# Node imajları (web, worker, migrate, test koşucusu) — tek Dockerfile, hedef (target) ile seçilir (04 §1).
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

# Arayüz kabul testleri (Playwright, 4 ekran) — yığının ağında web'e karşı koşar
FROM mcr.microsoft.com/playwright:v1.64.1-noble AS e2e
ENV CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY --from=deps /app /app
CMD ["pnpm", "--filter", "@eworks/web", "exec", "playwright", "test"]
