# syntax=docker/dockerfile:1
# Mükellef Takip web (Next.js standalone). Derleme bağlamı: proje kökü.

ARG NODE_IMAGE=node:24.22.0-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w web --include-workspace-root --no-audit --no-fund

FROM deps AS build
COPY apps/web apps/web
WORKDIR /app/apps/web
# Tarayıcı API'ye aynı adres üzerinden (Caddy /api → api) ulaşır: CORS ve üçüncü taraf çerez gerekmez
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} NEXT_TELEMETRY_DISABLED=1
# npm run build → prebuild: tip denetimi, lint, birim testleri. Testler geçmezse imaj oluşmaz.
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 TZ=Europe/Istanbul
WORKDIR /app
COPY --from=build --chown=root:root /app/apps/web/.next/standalone ./
COPY --from=build --chown=root:root /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=root:root /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/web/server.js"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
