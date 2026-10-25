# syntax=docker/dockerfile:1
# Satış ekranı (satis/web, Next.js standalone, /satis altında). Derleme bağlamı: proje kökü.

ARG NODE_IMAGE=node:24.22.0-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY satis/api/package.json satis/api/
COPY satis/web/package.json satis/web/
RUN npm ci -w satis-web --include-workspace-root --no-audit --no-fund

FROM deps AS build
COPY satis/web satis/web
WORKDIR /app/satis/web
ENV NEXT_TELEMETRY_DISABLED=1
# npm run build → prebuild: tip denetimi, lint, birim testleri. Testler geçmezse imaj oluşmaz.
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3100 TZ=Europe/Istanbul
WORKDIR /app
COPY --from=build --chown=root:root /app/satis/web/.next/standalone ./
COPY --from=build --chown=root:root /app/satis/web/.next/static ./satis/web/.next/static
USER node
EXPOSE 3100
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "satis/web/server.js"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3100/satis/giris').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
