# API (NestJS modüler monolit)

Genel kurallar: `../../CLAUDE.md`. Mimari: `../../docs/ai/architecture.md`.

## Girişler
- `src/main.ts` → `AppModule`: HTTP (`/api` öneki). Kuyruk processor'u veya zamanlayıcı **kaydetmez**.
- `src/worker.ts` → `WorkerModule`: BullMQ processor'ları, zamanlanmış işler (SGK gece senkronu 02:00, hatırlatıcı 08:30, outbox dağıtıcı). HTTP dinlemez.
- `migrate`: `prisma migrate deploy` (Docker'da tek seferlik container).

## Yerleşim
```
src/platform/       config, database, crypto, audit, events, logging, security  (iş kuralı yok)
src/shared-kernel/  saf değer nesneleri
src/modules/<ctx>/  domain / application / infrastructure / interface/http / <ctx>.module.ts / index.ts
```

## Yeni özellik eklerken
1. Hangi context? (`docs/ai/bounded-contexts.md`). Yeni context gerekiyorsa ADR.
2. Kural → `domain/*.ts` saf fonksiyon + `*.spec.ts`.
3. Use-case → `application/*.service.ts` (tenantId parametre olarak gelir; transaction burada).
4. Prisma/dış istemci → `infrastructure/`. Dış servis: port + `live` + `mock` istemci, `*_MODE` env.
5. Uç → `interface/http/*.controller.ts` + DTO; `@UseGuards(AuthGuard)` ve `@CurrentUser()` identity'nin `index.ts`'inden.
6. Başka context'e yan etki → domain event (`platform/events`), doğrudan servis çağrısı değil.
7. Başka context'ten okuma → onun `index.ts`'indeki facade.
8. Hassas işlem → `AuditService.log` (kişisel verinin kendisini yazma).
9. Yeni env → `platform/config/config.ts` şeması + `.env.example` + `infra/docker/compose*.yml` (sır ise Docker secret + `X_FILE`).
10. Yeni tenant'lı tablo → `tenantId` (ya da üst tabloya FK) + RLS politikası migration'ı + `test/security.e2e-spec.ts`'e çapraz erişim testi.
11. Kişi kimlik alanı (TCKN, ad) → `PersonalDataService.seal/open`, yanıtta `maskTckn`.
12. `npm test`, `npm run lint`, `npm run arch:check`, `npm run test:e2e` (Docker) yeşil.

## Tuzaklar
- Büro bağlamı: büroyu bilmeyen yol (giriş, geri dönüş, worker) `runAsSystem`/`runAsTenant` kullanır; aksi hâlde RLS satırları gizler ve sorgu boş döner (hata değil!).
- Worker'a özgü sağlayıcı (processor, zamanlayıcı) `AppModule`'e girmez; `<Context>WorkerModule`.
- ESM: importlarda `.js` uzantısı.
- Prisma istemcisi `src/generated/prisma` (üretilir; `npx prisma generate`). Şema değişince migration: `npx prisma migrate dev --name <ad>`.
- `Decimal` alanlar JSON'da string döner; web bunu bekliyor, değiştirme.
- Route ve yanıt şekilleri web + eklenti sözleşmesidir; README'deki uç tablosuyla birlikte güncelle.
- Seed (`prisma/seed.ts`) verileri sıfırlar; yalnız geliştirme.
