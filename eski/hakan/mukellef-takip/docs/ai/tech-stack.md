# Teknoloji yığını

Yeni bağımlılık eklemeden önce burada "onaylı" listede olup olmadığına bak. Listede yoksa gerekçesiyle kullanıcıya sor; eklenirse bu dosyayı güncelle.

## Korunan (mevcut, uygun)

| Katman | Teknoloji | Not |
|---|---|---|
| Backend | NestJS 12 (ESM, TypeScript 6), Express | Modüler monolit |
| ORM / DB | Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 17 | Şema `prisma/schema/` altında context başına dosya (Faz 2) |
| Kuyruk | BullMQ 6 + Redis 7 | Yalnız worker container'ında processor |
| Doğrulama | class-validator (HTTP DTO), zod (config) | `ValidationPipe({ whitelist, forbidNonWhitelisted })` |
| Dosya | exceljs, jszip (akış + bayt sayımı), fast-xml-parser (XXE kapalı) | Zip bombası korumaları korunur |
| Web | Next.js 16 App Router, React 19, Tailwind 4, lucide-react | Next sürümü eğitim verisinden farklı: `apps/web/AGENTS.md` |
| Eklenti | Chrome Manifest V3, `activeTab` + `scripting` | Ham tablo gönderir, tanıma sunucuda |
| Test | Vitest 4, supertest; e2e Testcontainers | |
| Kalite | oxlint, Prettier, ESLint (web), dependency-cruiser (katman kuralları) | |
| AI | `@anthropic-ai/sdk` | Varsayılan kapalı; büro onayı gerekir |

## Değiştirilen / eklenen (güvenlik ve ölçek gerekçeli)

| Eski | Yeni | Gerekçe | Faz |
|---|---|---|---|
| JWT `localStorage` | BFF + HttpOnly çerez, 15 dk access + dönen refresh (`Session`) | XSS ile token çalınması, uzun ömürlü iptal edilemez token | API 2, web 3 |
| bcryptjs | argon2id (`@node-rs/argon2`), girişte rehash | Bellek-sert, GPU saldırısına dayanıklı; bcrypt hash'leri girişte dönüştürülür | 1 |
| `VAULT_KEY` env | `KeyManagementPort`: `local` (dev) / **OpenBao Transit** (prod) envelope encryption | Anahtar uygulama belleği ve env dışında; rotasyon | 1–2 |
| Uygulama içi tenant filtresi | + PostgreSQL RLS | Savunma derinliği | 2 |
| console log | nestjs-pino + redaksiyon | Yapılandırılmış log, PII sızıntısı yok | 1 |
| — | helmet, `@nestjs/throttler` (Redis) | Başlıklar, brute force | 1 |
| — | Caddy (TLS, HSTS) | Tek giriş noktası | 1 |
| — | Transactional outbox (kendi tablo + dağıtıcı) | Context'ler arası güvenilir yan etki | 2 |
| `next dev` ile Docker | `next build` + `output: 'standalone'` | Canlı performansı, küçük imaj | 1 |
| — | Şifreli `pg_dump` yedeği (backup servisi) + off-site senkron | Felaket kurtarma (MinIO resmi imaj yayımlamadığı için kullanılmadı) | 1 |
| — | GitHub Actions: lint, test, build, arch, gitleaks, Trivy | | 1 |

## Planlanan

- Web: TanStack Query, `packages/contracts` (Faz 3)
- Mobil: Expo SDK (güncel), expo-router, expo-secure-store, expo-local-authentication, expo-notifications, EAS Build (Faz 4)
- Gözlemlenebilirlik: OpenTelemetry, Prometheus, Grafana, Loki (Faz 5)

## Yasaklı / kaçınılacak

- Kurum şifresi veya kişisel veri işleyen **yabancı SaaS** (log, hata takibi, analitik) — KVKK yurt dışı aktarım. Gerekirse self-hosted (ör. GlitchTip, Plausible self-hosted).
- Tarayıcıda token saklama (`localStorage`/`sessionStorage`) — yalnız kullanıcı tercihleri (tema, görülen sürüm notu) saklanabilir.
- GİB/SGK'ya **tarayıcı otomasyonu / CAPTCHA çözme** (Puppeteer/Playwright/Selenium robotları).
- `eval`, dinamik `require`, `dangerouslySetInnerHTML` (zorunluysa sanitize + gerekçe).
- MD5/SHA1 parola özeti, kendi yazılmış kripto algoritması (TOTP RFC uygulaması ve AES-GCM sarmalayıcı hariç, testli).
- Postgres'e superuser veya tablo sahibi rolüyle uygulama bağlantısı.
- Docker'da `latest` etiketi, root kullanıcı, host'a açık veritabanı portu (prod).
