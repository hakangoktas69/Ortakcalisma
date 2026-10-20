# syntax=docker/dockerfile:1
# Doğrulama imajı: statik kontroller + birim + API regresyon (e2e) testleri. compose.test.yml ile çalışır.
# Yerel Node sürümünden bağımsızdır (Node 24); `npm run verify` kullanır.
ARG NODE_IMAGE=node:24.22.0-slim

FROM ${NODE_IMAGE} AS verify
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY apps apps
RUN cd apps/api && DATABASE_URL="postgresql://x:x@localhost:5432/x" npx prisma generate
ENV CI=1 NEXT_TELEMETRY_DISABLED=1
CMD ["npm", "run", "verify:ci"]

# Arayüz regresyonu: çalışan yığına karşı dört ekran boyutunda Playwright (sürüm @playwright/test ile aynı olmalı)
FROM mcr.microsoft.com/playwright:v1.64.1-noble AS ui
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w web --include-workspace-root --no-audit --no-fund
COPY apps/web apps/web
WORKDIR /app/apps/web
ENV CI=1
CMD ["npx", "playwright", "test"]
