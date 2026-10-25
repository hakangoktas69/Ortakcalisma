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
