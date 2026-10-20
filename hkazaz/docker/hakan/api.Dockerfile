# Mükellef Takip API (NestJS + Prisma). Build bağlamı: hakan/mukellef-takip
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w api --include-workspace-root

COPY apps/api apps/api
WORKDIR /app/apps/api
# prisma generate için geçici adres; gerçek adres docker-compose'dan gelir
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" npx prisma generate && npm run build

EXPOSE 4000
# Migration her açılışta; demo verisi (seed) yalnızca ilk açılışta
CMD ["sh", "-c", "npx prisma migrate deploy && if [ ! -f /state/seeded ]; then npx prisma db seed && touch /state/seeded; fi && node dist/main"]
