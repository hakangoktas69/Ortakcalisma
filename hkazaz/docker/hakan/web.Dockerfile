# Mükellef Takip web (Next.js). Build bağlamı: hakan/mukellef-takip
# Not: `next build` şu an /beyanname sayfasında hata veriyor (Next.js "Render in Browser"
# bailout). Proje README'si de geliştirme modunu tarif ettiği için `next dev` ile çalışır.
FROM node:24-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w web --include-workspace-root

COPY apps/web apps/web
WORKDIR /app/apps/web
# Tarayıcı API'ye ana makinedeki port üzerinden ulaşır
ENV NEXT_PUBLIC_API_URL=http://localhost:4000/api NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000
CMD ["npx", "next", "dev", "-H", "0.0.0.0", "-p", "3000"]
