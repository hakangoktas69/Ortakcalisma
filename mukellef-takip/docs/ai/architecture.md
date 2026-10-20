# Mimari

> Kısa özet. Ayrıntılı anlatım (katmanlar, yapı taşları, outbox, tutarlılık, taktik borç): [docs/03-taktiksel-tasarim/](../03-taktiksel-tasarim/01-katmanlar.md), çalışma zamanı ve veri modeli: [docs/04-mimari/](../04-mimari/01-calisma-zamani.md).

## Genel görünüm

```
          İnternet
             │ 443 (TLS, HSTS)
        ┌────▼────┐
        │  Caddy  │  ters vekil — tek açık port
        └─┬─────┬─┘
  edge ağı│     │
   ┌──────▼─┐ ┌─▼───────────────┐         ┌──────────────┐
   │  web   │ │  api (NestJS)   │         │ worker       │  aynı imaj, farklı giriş:
   │Next.js │ │  src/main.ts    │         │ src/worker.ts│  BullMQ işleri, zamanlayıcı,
   └────────┘ └──┬────┬────┬────┘         └──┬────┬──────┘  outbox dağıtıcı
           app ağı│    │    │                 │    │
            ┌────▼┐ ┌─▼────────┐        ┌─────▼┐   │
            │Redis│ │ OpenBao  │ (KMS)  │      │   │
            └─────┘ └──────────┘        │      │   │
           data ağı (internal)          │      │   │
            ┌──────────────────────────▼──────▼───▼┐
            │ PostgreSQL 17 (RLS, app_user ≠ owner) │──► şifreli yedek (dosya → off-site)
            └───────────────────────────────────────┘
Chrome eklentisi ──(eklenti anahtarı, gib:import)──► api /api/import/page
Mobil (Faz 4) ──(refresh token, SecureStore)──► api
```

**Modüler monolit:** Tek NestJS kod tabanı ve tek veritabanı; içinde DDD bounded context'ler sıkı sınırlarla ayrılır. HTTP (`api`) ve arka plan işleri (`worker`) ayrı container'larda ölçeklenir. Bir context ileride ayrı servise çıkarılacaksa sınırı zaten hazırdır (public API + event). Gerekçe: `docs/adr/0001-moduler-monolit.md`.

## Backend dizin yapısı (`apps/api/src`)

```
main.ts                HTTP girişi (AppModule)
worker.ts              Kuyruk/zamanlayıcı girişi (WorkerModule) — HTTP dinlemez
app.module.ts          HTTP: platform + tüm context modülleri (processor'sız)
worker.module.ts       Worker: platform + processor/zamanlayıcı sağlayan modüller
platform/              Teknik altyapı (iş kuralı içermez)
  config/              zod ile ortam doğrulaması, *_FILE (Docker secrets) desteği — config.ts
  database/            PrismaService, RLS havuzu (rls-pool.ts), istek/iş bağlamı (tenant-context.ts)
  crypto/              VaultService (AES-256-GCM, v1/v2, blind index), kms.ts (OpenBao), personal-data.ts
  audit/               AuditService (hash zinciri)
  events/              OutboxService, @OnDomainEvent, OutboxDispatcher (worker)
  logging/             pino + PII redaksiyonu
  security/            hız sınırı (Redis), helmet ayarları http/configure-app.ts
  files/               güvenli Excel/CSV okuma (zip bombası koruması)
shared-kernel/         Tüm context'lerin kullandığı saf değer nesneleri (Period, TaxNumber, Tckn, Money)
modules/<context>/     Bounded context (aşağıda)
generated/prisma/      Prisma istemcisi (üretilir, elle düzenlenmez)
```

## Context iç yapısı

```
modules/<context>/
  domain/            Entity, value object, domain servisleri (saf kurallar), domain event tipleri,
                     repository PORT arayüzleri. Nest, Prisma, HTTP, process.env YOK. Birim testleri burada.
  application/       Use-case'ler: komut (yazma) ve sorgu (okuma) servisleri. Transaction sınırı burada.
                     Dış servis portları (ör. ViziteClient) burada tanımlanır.
  infrastructure/    Prisma repository'leri, dış istemciler (SOAP, iyzico, WhatsApp, Claude),
                     parser'lar (XML/Excel/tablo), BullMQ processor'ları.
  interface/http/    Controller + class-validator DTO. İnce: doğrula → use-case çağır → yanıtla.
  <context>.module.ts
  index.ts           PUBLIC API: diğer context'lerin kullanabileceği tek giriş
                     (query facade'ları, event tipleri, guard/decorator gibi paylaşılanlar).
```

### Bağımlılık kuralları (`apps/api/.dependency-cruiser.cjs`, `npm run arch:check`)

| Kaynak | Import edebilir |
|---|---|
| `domain` | aynı context'in `domain`'i, `shared-kernel` |
| `application` | `domain`, `shared-kernel`, `platform`, diğer context'in `index.ts`'i |
| `infrastructure` | `domain`, `application`, `platform`, `shared-kernel`, `generated/prisma` |
| `interface` | `application`, `domain` (tipler), `platform`, diğer context `index.ts` (ör. identity guard'ları) |
| başka context'in iç dosyası | **yasak** — yalnız `modules/<x>/index.ts` |
| `shared-kernel` | hiçbir şey (saf) |

Pragmatik istisna: Basit CRUD use-case'lerinde application servisi `PrismaService`'i doğrudan kullanabilir (repository zorunlu değil); iş kuralı varsa kural `domain`'de saf fonksiyon olarak yaşar ve test edilir. Bu, mevcut kodun "saf kural dosyası + servis" desenini korur (`declaration-rules.ts`, `edefter-rules.ts`, `inbox-items.ts`…).

## Context'ler arası iletişim

1. **Senkron sorgu:** Bir context diğerinin verisini okumak için onun `index.ts`'teki *query facade*'ını kullanır (ör. `workspace` → `TaxFilingQueries.control()`). Başka context'in tablosuna doğrudan sorgu atılmaz (geçiş sürecindeki istisnalar `roadmap.md`'de listelenir).
2. **Asenkron yan etki — domain event + transactional outbox:** Komut, kendi verisiyle **aynı transaction'da** `OutboxEvent` satırı yazar. Worker'daki dağıtıcı bekleyen olayları okuyup kayıtlı abonelere (`@OnDomainEvent('tebligat.imported')`) iletir; başarısız olan yeniden denenir, işlenen işaretlenir. Abone idempotent olmalıdır (ör. `Notification.dedupeKey`).
   - Örnekler: `tebligat.imported`, `sgk.report.received`, `billing.payment.settled` → `notifications`.
3. **Worker'a özgü sağlayıcılar:** kuyruk işleyicisi/zamanlayıcı içeren context'ler ayrıca `<Context>WorkerModule` dışa açar (ör. `SocialSecurityWorkerModule`); `AppModule` bunları yüklemez, `WorkerModule` yükler.
4. **Ortak kimlik:** `identity` context'i `AuthGuard`, `AdminGuard`, `CurrentUser`, `ImportGuard`'ı `index.ts`'ten dışa açar.

## Okuma modeli (CQRS read side)

`workspace` context'i (iş kutusu, dashboard, CSV raporlar) kendi aggregate'ine sahip değildir (yalnız `InboxSnooze`); diğer context'lerin query facade'larını birleştirir. İş kutusu **saklanmaz**, her istekte türetilir; işlerin kararlı anahtarı vardır (`decl:<firma>:KDV1:2026-09`).

## Anti-corruption layer: `data-intake`

Eklentiden gelen ham GİB/SGK sayfa tablosu (`POST /api/import/page`) başlıklardan tanınır ve ilgili context komutuna (beyanname, tebligat, e-Bildirge) çevrilir. Kurum ekranı değiştiğinde yalnız bu katman ve ilgili parser değişir; eklenti yeniden dağıtılmaz.

## Çok kiracılık

- Paylaşımlı şema, satır bazlı `tenantId`. **İki kat savunma:** (1) uygulama sorguları `tenantId` ile filtreler; (2) PostgreSQL **RLS** — uygulama `mukellef_app` rolüyle (`app_user` üyesi, tablo sahibi değil) bağlanır.
- **Bağlam nasıl taşınır:** her HTTP isteği `runWithDbContext` ile sarılır; `AuthGuard`/`ImportGuard` oturumu doğrulayınca `setCurrentTenant()` çağırır. Prisma'nın `pg` havuzu (`rls-pool.ts`) her bağlantı alışında çağıranın bağlamını `app.tenant_id` / `app.bypass_rls` oturum ayarlarına yazar. Politikalar `app_tenant()` / `app_bypass()` fonksiyonlarını kullanır; alt tablolar (ör. `SgkReport`) üst tablo üzerinden `EXISTS` ile büroya bağlanır.
- **Sistem bağlamı:** büroyu henüz bilmeyen güvenilir yollar (giriş, oturum doğrulama, iyzico geri dönüşü, worker işleri) `runAsSystem()`; büro döngüsü olan işler `runAsTenant()`. Dikkat: Prisma sorguları tembeldir — bağlam yardımcıları sorguyu kendi içinde başlatır, bağlam dışında oluşturulmuş sorgu nesnesini başka bağlamda `await` etmeyin.
- Tehdit modeli: RLS, unutulmuş `tenantId` filtresine karşı ikinci savunmadır; SQL enjeksiyonuna karşı koruma Prisma'nın parametreli sorgularıdır.
- Ortak tablolar (`TaxCalendarEvent`, sistem `PetitionTemplate`'leri `tenantId IS NULL`) okuma politikasıyla herkese açıktır.

## Kimlik doğrulama

- Bugün: Bearer JWT (8 saat) + her istekte DB kontrolü (`isActive`, `sessionVersion`, rol DB'den).
- Hedef (Faz 2 API, Faz 3 web): 15 dk access token + **dönen refresh token** (`Session` tablosu, hash'li, cihaz başına, yeniden kullanımda tüm aile iptal). Web'de token tarayıcı JS'ine hiç verilmez: Next.js BFF route handler'ı `HttpOnly; Secure; SameSite=Strict` çerezle tutar. Mobilde Expo SecureStore + biyometrik kilit. Eklenti: kapsamı dar, süreli `ApiToken`.

## Frontend mimarisi

- **Web (hedef, Faz 3):** `src/app/` yalnız route; özellikler `src/features/<context>/` (bileşen, hook, api çağrısı). Paylaşılan tipler `packages/contracts`. Sunucu durumu TanStack Query. API çağrıları BFF üzerinden (`/bff/*`), CSP nonce'lu.
- **Mobil (hedef, Faz 4):** Expo + expo-router; `packages/contracts` ve ortak API istemcisi; okuma + onay odaklı.

## Dağıtım

Docker Compose (`infra/docker`): `compose.yml` + `compose.dev.yml` / `compose.prod.yml`. Tek API imajı üç komutla çalışır: `api`, `worker`, `migrate`. Ayrıntı: `infra/docker/README.md`.
