# Test stratejisi ve derleme kapıları

Amaç: yalnız yazım ve tip hataları değil, **çalışma anı hataları** (500 dönen uç, çözülemeyen bağımlılık, RLS'in sakladığı veri, tarayıcıda çöken sayfa, ekrandan taşan arayüz) derlemeden önce yakalansın.

## Katmanlar

| Katman | Nerede | Ne sınar | Altyapı |
|---|---|---|---|
| Statik | `npm run lint`, `npm run typecheck` | oxlint + ESLint, DDD katman kuralları (dependency-cruiser), TypeScript (api + web, Next tip üretimiyle) | yok |
| API birim | `apps/api/src/**/*.spec.ts` | Saf iş kuralları, ayrıştırıcılar, kripto/KMS, config, log maskeleme, kurum istemcileri (sahte SOAP/HTTP) | yok |
| API regresyon (e2e) | `apps/api/test/*.e2e-spec.ts` | **Her context'in her ucu** gerçek Nest uygulaması + gerçek PostgreSQL (RLS'e tabi rol) + Redis üzerinden; worker (DI, outbox, kuyruk, WhatsApp, backfill); iyzico ödeme akışı (sahte iyzico sunucusu); hız sınırı | PostgreSQL 17, Redis 7 |
| Web birim | `apps/web/src/**/*.test.ts` | API istemcisi (401/403 yönlendirmeleri), içerik ve menü bağlantı tutarlılığı | yok |
| Arayüz regresyonu | `apps/web/e2e/*.spec.ts` (Playwright) | Her panel sayfası **telefon 375 / tablet 768 / laptop 1366 / büyük ekran 1920**'de: çalışma anı hatası, konsol hatası, API 5xx, yatay taşma, kırpılan içerik; giriş, menü, arama, çıkış akışları | çalışan Docker yığını |

E2E dosya düzeni (`apps/api/test`): `identity`, `taxpayers-tax-filing`, `sgk-tebligat-intake`, `invoicing-payroll`, `billing-documents-assistant`, `notifications-workspace`, `iyzico`, `worker`, `security` (izolasyon, RLS havuzu, denetim zinciri), `throttle`. Ortak altyapı `test/support/` — yığın koşu başına bir kez kurulur (`global-setup.ts`: geçici veritabanı, migration, `prisma/seed.ts` demo verisi, ikinci büro B); her dosya `bootApp()` ile kendi uygulamasını açar.

## Kapsam eşikleri (düşerse kapı kapanır)

- Birim, saf katmanlar (`domain/`, `shared-kernel/`, `*parser*`): fonksiyon %95, satır %92, ifade %90, dal %80 — `apps/api/vitest.config.ts`
- E2E, bütün `src/`: fonksiyon %90, satır %87, ifade %82, dal %60 — `apps/api/vitest.config.e2e.ts`

Eşikler mevcut seviyenin hemen altındadır; yeni kod testsiz eklenirse düşer. Eşiği **düşürmek yerine test ekleyin**.

## Kapılar

| Komut | Ne zaman | Çalıştırır |
|---|---|---|
| `npm run build -w api` / `-w web` | her uygulama derlemesi (Docker imajı dahil) | `prebuild`: lint, (api: katman kuralları), tip denetimi, birim testleri (api: kapsam eşikli). Docker imajı da `npm run build` ile derlenir: testler geçmezse **imaj oluşmaz** |
| `npm run verify` | derlemeden / dağıtımdan önce | izole Docker test yığınında (Node 24, geçici PostgreSQL + Redis): statik + birim + **API regresyon** (eşikli). Yerel Node sürümünden bağımsız |
| `npm run build` (kök) | yerel tam derleme | `verify` + iki uygulamanın kapılı derlemesi |
| `npm run stack:dev` | geliştirme yığını | `verify` → imajlar (kapılı) → yığın → `test:ui` (4 ekranda arayüz) |
| `npm run stack:prod` | üretim dağıtımı | `verify` → imajlar (kapılı) → yığın |
| `npm run test:ui` | yığın ayaktayken | Playwright container'ı, yığının iç ağı üzerinden; rapor `apps/web/playwright-report/` |
| `npm run hooks:install` (isteğe bağlı) | bir kez | `git push` öncesi, `mukellef-takip/` değiştiyse `verify` |
| CI (`.github/workflows/mukellef-takip.yml`) | her push / PR | `verify:ci` → arayüz testleri → imaj + Trivy |

## Kurallar (yeni kod)

1. Yeni **uç** → ilgili context'in e2e dosyasına: başarılı yol, doğrulama hatası (400), yetkisiz (401/403), **başka büronun kaydı (404)**, kişisel veri maskesi (`expectNoFullTckn`).
2. Yeni **iş kuralı / ayrıştırıcı** → yanında `*.spec.ts` (saf, hızlı).
3. Yeni **dış servis istemcisi** → sahte sunucu/`fetch` ile birim testi; canlı servise test isteği atılmaz.
4. Yeni **sayfa** → `apps/web/e2e/support.ts` içindeki `PANEL_ROUTES`'a ekleyin; dört ekranda otomatik sınanır.
5. Yeni **worker işi / olay abonesi** → `test/worker.e2e-spec.ts`.
6. Test verisinde gerçek kişisel veri yok: `makeTckn()` ile geçerli ama sahte T.C. no.
7. Bir testi geçirmek için üretim kodunda test kısayolu açmayın; tek istisna `RATE_LIMIT=off` (config yalnız `NODE_ENV=test`'te kabul eder) — hız sınırı `throttle.e2e-spec.ts`'te açık sınanır.

## Bu testlerin yakaladığı gerçek hatalar (örnek)

- Aynı VKN ile firma ekleme 500 dönüyordu → genel Prisma hata filtresi (409/404).
- Tablette hesap menüsü içerik arkasında kalıyor, "Çıkış yap" tıklanamıyordu (sticky yan menünün yığın bağlamı).
- Telefonda iş kutusu ve genel bakış ızgaraları ekrandan taşıyor / kırpılıyordu.
- Temiz ortamda web tip denetimi Next'in ürettiği tipleri bulamıyordu.
