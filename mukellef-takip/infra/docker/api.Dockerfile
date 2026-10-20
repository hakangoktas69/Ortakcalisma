# syntax=docker/dockerfile:1
# Mükellef Takip API — tek imaj, üç komut: api (dist/main.js), worker (dist/worker.js), migrate (ayrı hedef).
# Derleme bağlamı: proje kökü (mukellef-takip). Bkz. infra/docker/README.md

ARG NODE_IMAGE=node:24.22.0-slim

FROM ${NODE_IMAGE} AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w api --include-workspace-root --no-audit --no-fund

FROM deps AS build
COPY apps/api apps/api
WORKDIR /app/apps/api
# prisma generate yalnız şemayı okur; gerçek adres çalışma anında secret'tan gelir
# npm run build → prebuild: lint, katman kuralları, tip denetimi, birim testleri (kapsam eşikli). Testler geçmezse imaj oluşmaz.
RUN DATABASE_URL="postgresql://derleme:derleme@localhost:5432/derleme" npx prisma generate && npm run build

# Migration (+ geliştirmede demo verisi): Prisma CLI ve tsx gerektiği için derleme bağımlılıklarıyla
FROM build AS migrate
COPY infra/docker/migrate-entrypoint.sh /usr/local/bin/migrate-entrypoint.sh
RUN chmod 0555 /usr/local/bin/migrate-entrypoint.sh && chown -R node:node /app/apps/api/src/generated
USER node
ENTRYPOINT ["/usr/local/bin/migrate-entrypoint.sh"]

FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w api --include-workspace-root --omit=dev --no-audit --no-fund && npm cache clean --force && mkdir -p apps/api/node_modules

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production TZ=Europe/Istanbul
WORKDIR /app
COPY --from=prod-deps --chown=root:root /app/node_modules ./node_modules
COPY --from=prod-deps --chown=root:root /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=root:root /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=root:root /app/apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
# Kod root'a ait ve salt okunur; süreç ayrıcalıksız kullanıcıyla çalışır
USER node
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
