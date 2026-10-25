# syntax=docker/dockerfile:1
# Satış API'si (satis/api). Ortak çekirdeği (şifre özeti, TOTP, denetim zinciri, Prisma istemcisi) apps/api'den
# derleme sırasında alır; çalışırken müşavir API'sinden bağımsızdır. Derleme bağlamı: proje kökü.

ARG NODE_IMAGE=node:24.22.0-slim

FROM ${NODE_IMAGE} AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY satis/api/package.json satis/api/
COPY satis/web/package.json satis/web/
RUN npm ci -w api -w satis-api --include-workspace-root --no-audit --no-fund

FROM deps AS build
COPY apps/api apps/api
COPY satis/api satis/api
RUN cd apps/api && DATABASE_URL="postgresql://derleme:derleme@localhost:5432/derleme" npx prisma generate
WORKDIR /app/satis/api
# npm run build → prebuild: lint, tip denetimi, birim testleri (kapsam eşikli). Testler geçmezse imaj oluşmaz.
RUN npm run build

FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY satis/api/package.json satis/api/
COPY satis/web/package.json satis/web/
RUN npm ci -w satis-api --include-workspace-root --omit=dev --no-audit --no-fund && npm cache clean --force && mkdir -p satis/api/node_modules

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production TZ=Europe/Istanbul
WORKDIR /app
COPY --from=prod-deps --chown=root:root /app/node_modules ./node_modules
COPY --from=prod-deps --chown=root:root /app/satis/api/node_modules ./satis/api/node_modules
COPY --from=build --chown=root:root /app/satis/api/dist ./satis/api/dist
COPY --from=build --chown=root:root /app/satis/api/package.json ./satis/api/package.json
WORKDIR /app/satis/api
USER node
EXPOSE 4100
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/satis/api/src/main.js"]
# Sağlık ucu oturum istemez; veritabanına bağlanabildiğini de denetler
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4100/api/satis/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
