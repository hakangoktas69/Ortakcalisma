# Mükellef Takip — Teknik Analiz (Technical Analysis)

> Kaynak: `hakan/mukellef-takip` (commit `64e3a49`, 19.10.2026). Kod, şema, yapılandırma ve testler incelenerek hazırlanmıştır.

## 1. Mimari genel bakış

```
┌──────────────────────┐     ┌──────────────────────┐
│  Web (Next.js 16)    │     │  Chrome eklentisi    │
│  React 19, Tailwind 4│     │  Manifest V3         │
│  :3000               │     │  activeTab+scripting │
└─────────┬────────────┘     └─────────┬────────────┘
          │ JWT (Bearer)               │ Eklenti anahtarı (gib:import)
          ▼                            ▼
┌─────────────────────────────────────────────────────┐
│  API (NestJS 12, ESM, TypeScript 6)  :4000/api       │
│  Modüller: auth, companies, declarations, sgk,       │
│  tebligat, edefter, invoices, payroll, petitions,    │
│  reports, billing, notifications, assistant, inbox   │
└───┬──────────────┬───────────────┬──────────────────┘
    │ Prisma 7     │ BullMQ        │ Dış servisler
    ▼              ▼               ▼
 PostgreSQL 17   Redis 7      SGK Vizite (SOAP), iyzico,
                              Meta WhatsApp, Claude API
```

- **Monorepo:** npm workspaces (`apps/api`, `apps/web`); eklenti ayrı klasör (`apps/extension`), build gerektirmez.
- **Yerel altyapı:** `docker-compose.yml` → PostgreSQL 17 + Redis 7.
- **Çok kiracılılık:** Paylaşımlı şema, satır bazlı `tenantId` filtresi (uygulama katmanında; ~320 `tenantId` kullanımı). PostgreSQL RLS kullanılmıyor.

## 2. Teknoloji yığını

| Katman        | Teknoloji                                                                      |
| ------------- | ------------------------------------------------------------------------------ |
| Backend       | NestJS 12, Prisma 7 (`@prisma/adapter-pg`), class-validator, BullMQ 6, ioredis |
| Frontend      | Next.js 16.4 (App Router), React 19.3, Tailwind CSS 4, lucide-react            |
| Dosya işleme  | exceljs, jszip, fast-xml-parser                                                |
| Güvenlik      | bcryptjs, Node `crypto` (AES-256-GCM, HMAC), kendi TOTP uygulaması, qrcode     |
| AI            | `@anthropic-ai/sdk` (varsayılan model `claude-opus-5-5`)                       |
| Test / kalite | Vitest 4, supertest, oxlint, Prettier, ESLint (web)                            |

## 3. Kod büyüklüğü

| Alan                                        | Satır  |
| ------------------------------------------- | ------ |
| `apps/api/src`                              | ~9.460 |
| `apps/web/src`                              | ~8.840 |
| `apps/api/prisma` (şema + migration + seed) | ~1.790 |
| `apps/extension`                            | ~270   |

## 4. Veri modeli

`schema.prisma` (673 satır) — başlıca modeller:

| Alan             | Modeller                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Kiracı ve kimlik | `Tenant`, `User` (rol ADMIN/STAFF, `sessionVersion`, TOTP), `ApiToken`, `AuditLog`         |
| Lisans           | `Subscription`, `Payment`                                                                  |
| Mükellef         | `Company`, `CompanyObligation`                                                             |
| Vergi            | `Declaration`, `TaxCalendarEvent`, `EDefterBerat`, `ETebligat`                             |
| SGK              | `SgkWorkplace`, `SgkReport`, `EmploymentEvent`, `EBildirgeDocument`                        |
| Fatura / bordro  | `Invoice`, `PayrollRun`, `PayrollLine`                                                     |
| Bildirim         | `Notification`, `NotificationRead`, `NotificationDelivery`                                 |
| Diğer            | `PetitionTemplate`, `Petition`, `AssistantConversation`, `AssistantMessage`, `InboxSnooze` |

18 migration, 12–19 Ekim 2026 arasında artımlı olarak eklenmiş. Kaynak ayrımı enum'larla (`DeclarationSource`, `InvoiceSource`, `PayrollSource` …) yapılıyor; bu, ileride ikinci veri kaynağı (ör. entegratör API) eklemeyi kolaylaştırır.

## 5. Modül bazında teknik notlar

### 5.1 Kimlik doğrulama ve yetkilendirme (`src/auth`)

- JWT (8 saat), **her istekte DB kontrolü**: `isActive`, `sessionVersion`, `tenantId` eşleşmesi. Rol token'dan değil DB'den okunur → rol değişikliği anında geçerli.
- `mfa` amaçlı ara token oturum olarak kabul edilmez.
- `PASSWORD_CHANGE_REQUIRED` ve `TWO_FACTOR_REQUIRED` durumlarında izinli uç listesi (allowlist) ile kısıtlama.
- Hesap kilidi: 5 hata → 15 dk (DB'de kalıcı); kayıtsız e-postada sabit maliyetli karşılaştırma (zamanlama saldırısına karşı).
- TOTP (RFC 6238) kendi uygulaması, RFC test vektörleriyle doğrulanmış; kod tekrar kullanımı engelli; 10 kurtarma kodu (hash'li).
- `ImportGuard`: JWT **veya** `gib:import` kapsamlı eklenti anahtarı; anahtar başka uçta geçmez.

### 5.2 Şifreli kasa (`src/vault`)

- AES-256-GCM, 12 bayt rastgele IV, biçim `v1:<iv>:<tag>:<ct>`. Sürüm öneki anahtar rotasyonuna hazırlık.
- Anahtar `VAULT_KEY` ortam değişkeninden; KMS entegrasyonu yok (kodda not düşülmüş).

### 5.3 SGK entegrasyonu (`src/sgk`)

- **Vizite:** Resmi SOAP 1.1 servisi (`soap-vizite.client.ts`) + mock istemci. Akış: `wsLogin → raporAramaTarihile → (kayıt sonrası) raporOkunduKapat → onayliRaporlarTarihile`. Kapatma işleminin DB yazımından _sonra_ yapılması veri kaybına karşı doğru tasarım.
- **Zamanlama:** BullMQ repeatable job, `0 2 * * *` Europe/Istanbul; eşzamanlılık 2, dakikada 20 işyeri, 3 deneme.
- **4A:** Arayüz (`tescil.types.ts`) + mock; `live-tescil.client.ts` boş (SGK kılavuzu bekleniyor). Strategy/adapter deseni sayesinde yalnızca bu dosya doldurulacak.
- **e-Bildirge:** Eklentiden gelen tablo, başlık tabanlı parser ile tanınır; işyeri eşleştirmesi 3 kademeli.

### 5.4 Tablo tanıma (eklenti → sunucu)

- Eklenti yalnızca ham tablo (başlık + hücre metni) gönderir; **tanıma sunucuda** (`table-parser.ts`, `tebligat-parser.ts`, `ebildirge-parser.ts`). GİB arayüzü değişirse eklenti yeniden dağıtılmadan sunucu tarafında düzeltilebilir — iyi bir karar.
- Varsayılan `dryRun` (önizleme) → kullanıcı onayı → yazma.
- CORS: yalnızca `WEB_ORIGIN` ve `chrome-extension://[a-p]{32}` deseni.

### 5.5 Faturalar (`src/invoices`)

- UBL-TR XML ayrıştırma (`ubl-parser.ts`), ETTN ile tekilleştirme, VKN'ye göre satış/alış yönü.
- **XXE kapalı**; ZIP akış olarak, gerçek açılan bayt sayılarak okunuyor (dosya başı 5 MB, toplam 300 MB); istek başı 20 dosya / 25 MB / 3000 fatura.
- KDV ön kontrol: hesaplanan, tevkifat, indirilecek, KDV2; beyanname yerine geçmediği açıkça belirtilmiş.

### 5.6 Bordro (`src/payroll`)

- Programdan bağımsız başlık arama (ilk 15 satır), zorunlu sütunlar: TCKN, Gün, SGK Matrahı.
- Satır kuralları: SGK işçi %14, işsizlik %1, ≤30 gün, net ≤ brüt; TCKN kontrol hanesi. e-Bildirge ile mutabakat (asıl + ek − iptal), PEK'te 1 TL tolerans.
- TCKN ekranda maskeli, denetim kaydına kişisel veri yazılmıyor.

### 5.7 Lisans ve ödeme (`src/billing`)

- Tutar sunucuda (`plans.ts`), kuruş yuvarlaması ondalık gösterimle (`roundKurus`).
- iyzico Checkout Form, IYZWSv2 HMAC-SHA256 imza. Callback'te tarayıcıya güvenilmez; sunucu iyzico'ya sorgu yapar ve `SUCCESS`, `fraudStatus=1`, sepet/konuşma no, tutar ve para birimi eşleşmesini doğrular.
- İdempotent lisans uzatma ("yalnızca hâlâ bekliyorsa" koşullu güncelleme), 6 eşzamanlı istekle test edilmiş.
- `extendExpiry` ay sonu taşmasını (31 Ocak + 1 ay) engelliyor.

### 5.8 Bildirimler (`src/notifications`)

- Sabah hatırlatıcısı `30 8 * * *` Europe/Istanbul; `dedupeKey` ile tek seferlik bildirim.
- WhatsApp: Meta Cloud API, şablon mesaj; açık rıza tarihli, numara değişince rıza düşer; teslimat `NotificationDelivery` tablosunda, kuyrukta yeniden denemeli.

### 5.9 AI asistan (`src/assistant`)

- Sağlayıcı soyutlaması (`anthropic` / `mock` / `off`), SSE ile akış (meta → delta → done/error).
- `redact.ts`: IBAN, e-posta, SGK sicil, telefon, TCKN, VKN regex ile maskeleme (sıralı; bilerek geniş).
- Web araması yalnızca resmi alan adlarıyla sınırlı; büro başı günlük kota denetim kaydından sayılıyor.
- Sohbetler yalnızca sahibine görünür.

### 5.10 İş kutusu (`src/inbox`)

- Açık işler saklanmaz, her istekte kaynaklardan **türetilir**; her işin kararlı anahtarı (`decl:<firma>:KDV1:2026-09`). "Sonra hatırlat" `InboxSnooze` tablosunda. Durum tutarsızlığı riskini ortadan kaldıran sade bir tasarım.

### 5.11 Raporlar

- CSV: UTF-8 BOM, `;` ayraç; `= + - @` ile başlayan metin hücrelerinde **formül enjeksiyonu koruması**; her indirme denetim kaydına.

### 5.12 Frontend

- App Router `(panel)` route group, 18 sayfa; her sayfa ince, mantık `components/*View.tsx` içinde.
- Kabuk: ikon menü, Ctrl+K komut paleti, açık/koyu/sistem tema (`gen-theme.mjs` ile üretilen CSS).
- SSS ve Yenilikler içeriği kodla sürümleniyor (`content/faq.ts`, `changelog.ts`).
- API istemcisi `lib/api.ts`: 401 → login, 403 kodlarına göre şifre değiştirme / 2FA kurulum yönlendirmesi.

## 6. Test durumu

- 18 birim test dosyası, ~115 test senaryosu. Kapsanan alanlar: auth guard, TOTP, redaksiyon, Anthropic sağlayıcı (sahte sunucu), iyzico istemcisi, planlar, firma aktarımı, tablo/tebligat/e-Bildirge parser'ları, e-Defter kuralları, fatura, bordro, hatırlatıcılar, iş kutusu, CSV, dilekçe şablonları.
- `vitest.config.e2e.ts` tanımlı ancak **`*.e2e-spec.ts` dosyası yok** — uçtan uca API testi bulunmuyor.
- Frontend için otomatik test yok.

## 7. Güvenlik değerlendirmesi

**İyi uygulamalar:** şifreli kasa + denetim kaydı, oturum sürümü ile anında iptal, 2FA politikası, sunucu tarafı tutar hesaplama, XXE/zip bombası koruması, CSV enjeksiyon koruması, `ValidationPipe({ whitelist, forbidNonWhitelisted })`, sınırlı CORS, eklenti için en az yetki (`activeTab`).

**İyileştirme önerileri:**

| #   | Bulgu                                                          | Öneri                                                                           |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | JWT `localStorage`'da (`mt_token`) — XSS durumunda çalınabilir | HttpOnly + SameSite çerez veya kısa ömürlü access + refresh token               |
| 2   | Genel HTTP hız sınırlama yok (yalnız hesap kilidi)             | `@nestjs/throttler` (özellikle `/auth/*`, `/assistant/ask`, `/import/*`)        |
| 3   | Güvenlik başlıkları (helmet/CSP) yok                           | API'ye helmet, web'e CSP                                                        |
| 4   | `.env.example`'da `JWT_SECRET="degistirin"`                    | Başlangıçta zayıf/varsayılan sırrı reddeden kontrol                             |
| 5   | Tenant izolasyonu yalnızca uygulama katmanında                 | Prisma middleware/extension ile zorunlu `tenantId` filtresi veya PostgreSQL RLS |
| 6   | `VAULT_KEY` ortam değişkeninde                                 | Üretimde KMS; `v1` öneki ile rotasyon prosedürü                                 |
| 7   | AI redaksiyonu regex tabanlı, isimleri yakalamıyor             | Kullanıcı uyarısı mevcut; ek olarak gönderim öncesi onay gösterimi korunmalı    |

## 8. Operasyon ve dağıtım açıkları

- Dockerfile, canlı compose/Kubernetes tanımı **yok**.
- CI/CD (GitHub Actions vb.) **yok**; lint/test elle çalıştırılıyor.
- Loglama/izleme (yapılandırılmış log, metrik, hata takibi) yok.
- Veritabanı yedekleme ve geri yükleme prosedürü yok.
- Eklenti Chrome Web Store'a paketlenmemiş; üretimde `https` API adresi için izin akışı mevcut.

## 9. Teknik borç ve açık işler (yol haritasından)

- [ ] Faz 1-canlı: iyzico canlı anahtar + https callback
- [ ] Faz 2b-canlı: SGK 4A canlı istemcisi
- [ ] Faz 2c: Canlı SGK pilot
- [ ] Faz 3c: Eklentinin gerçek GİB sayfasında doğrulanması; resmi tatil/süre uzatımı takvimi
- [ ] Faz 4-canlı: Meta WhatsApp canlı; e-Tebligat gerçek sayfa doğrulaması
- [ ] Faz 5c-entegratör: e-Fatura entegratör API'si
- [ ] Faz 5d-canlı: Gerçek bordro programı çıktılarıyla doğrulama
- [ ] Faz 6-canlı: Claude API gerçek anahtarla deneme; KVKK

## 10. `mert/eworks` ile teknik karşılaştırma

| Konu          | Mükellef Takip (hakan)                          | Eworks (mert)                                          |
| ------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Backend       | NestJS + PostgreSQL (kendi sunucusu)            | Supabase (Postgres + Edge Functions)                   |
| GİB erişimi   | Eklenti, kullanıcının oturumundaki tabloyu okur | Python robotu (tarayıcı otomasyonu) ile otomatik giriş |
| Şifre saklama | GİB şifresi saklanmaz; SGK şifreleri AES-GCM    | GİB hesapları Supabase Vault'ta                        |
| Frontend      | Next.js uygulaması                              | Tek HTML tasarım + yerel sunucu                        |

Ortak bir ürüne gidilecekse: veri modeli (firma, beyanname) ortaklaştırılmalı ve robot çıktısı Mükellef Takip'e `DeclarationSource` altında ikinci bir kaynak olarak bağlanabilir.

## 11. Teknik öneriler (öncelik sırasıyla)

1. CI hattı: `lint` + `test` + `build` (api ve web) her push'ta.
2. Rate limiting + helmet + JWT'nin HttpOnly çereze taşınması.
3. Prisma düzeyinde zorunlu tenant filtresi (savunma derinliği).
4. E2E API testleri (auth, tenant izolasyonu, import, billing callback).
5. Canlı imajları (Dockerfile), migrasyon stratejisi, yedekleme, log/izleme.
6. Resmi tatil ve GİB süre uzatımı verisi için `TaxCalendarEvent` tablosunun beslenmesi.
