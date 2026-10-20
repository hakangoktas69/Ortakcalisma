# Yol haritası ve durum

> İşe başlamadan bu dosyaya bak; bir adım bitince işaretle. Ürün özelliklerinin geçmiş fazları README "Yol haritası"ndadır.

## Mimari yeniden yapılandırma (2026-10-20'de onaylandı)

Kararlar: modüler monolit, Expo mobil, Türkiye'de VM/on-prem. Gerekçeler `docs/adr/`.

### Faz 0 — Claude bağlamı ve dokümanlar ✅
- [x] `CLAUDE.md`, `docs/ai/*`, `docs/adr/*`, `apps/*/CLAUDE.md`, `.claude/settings.json`, repo kökü `CLAUDE.md`
- [x] Ekip hafızası (2026-10-20): `docs/ai/memory/` otomatik hafıza dizini (SessionStart kancası), `memory:check` (verify + CI), `/hafiza` ve `/oryantasyon` becerileri, Obsidian kasası `docs/`

### Faz 1 — Docker yığını + hızlı güvenlik ✅
- [x] `infra/docker`: api (api/worker/migrate hedefleri), web (standalone), compose dev/prod, Caddy (TLS/HSTS), OpenBao (Raft), şifreli yedek, Docker secrets, iç ağlar, salt okunur/ayrıcalıksız container'lar
- [x] `src/worker.ts` — kuyruk işleyicileri, zamanlayıcılar ve outbox HTTP'den ayrı
- [x] zod config doğrulaması (zayıf sır / demo ödeme / http adres üretimde reddedilir, `*_FILE` desteği)
- [x] helmet, Redis'li hız sınırı, pino + PII redaksiyonu, `/api/health`
- [x] argon2id + bcrypt'ten otomatik dönüşüm
- [x] AuditLog hash zinciri + uygulama rolünde UPDATE/DELETE yok
- [x] `next build` düzeltmesi (panel `<Suspense>`), web güvenlik başlıkları
- [x] CI: `.github/workflows/mukellef-takip.yml` (lint, mimari, birim + e2e, derleme, npm audit, gitleaks, Trivy, SBOM)

### Faz 2 — Backend DDD ✅ (kalanlar aşağıda)
- [x] `platform/` ve `shared-kernel/`
- [x] 13 context'e taşıma, her birinde `index.ts` public API; `npm run arch:check` (dependency-cruiser) yeşil
- [x] Outbox + domain eventler: `tebligat.imported`, `sgk.reports.received`, `billing.license.extended` → notifications
- [x] Tenant izolasyon e2e testleri (`apps/api/test/security.e2e-spec.ts`)
- [x] Prisma şeması context dosyalarına bölündü (`prisma/schema/`); RLS politikaları ve roller (migration `rls_ve_roller`)
- [x] `Session` + yenileme anahtarı uçları (`/auth/refresh`, `/logout`, `/sessions`)
- [x] TCKN / ad soyad kolon şifreleme + blind index; SGK `raw` yazılmıyor; eski kayıtlar için worker backfill
- [x] OpenBao Transit adaptörü (`v2:` biçimi), token yenileme
- [x] `ApiToken.expiresAt`, `Tenant.assistantConsentAt` + `PUT /api/assistant/consent`
- [x] WhatsApp'a kişisel veri gitmiyor (`Notification.externalBody`)
- [ ] `packages/contracts` (web/mobil ortak tipleri) — Faz 3 başında
- [ ] Düz `tckn`/`fullName`/`raw` kolonlarını kaldıran migration (backfill tüm kurulumlarda bittikten sonra)
- [ ] Anahtar rotasyonu sonrası yeniden şifreleme işi (`VaultService.needsRotation` hazır)
- [ ] Saklama süresi ve imha işi (KVKK md.7): context başına süreler hukukçuyla belirlenecek
- [ ] Kişisel veri dışa aktarma / silme talebi aracı (KVKK md.11)
- [ ] Web'den yönetici için asistan onayı ve oturum listesi ekranları (API hazır)

### Regresyon testleri ve duyarlı arayüz ✅ (2026-10-20)
- [x] API: 13 context'in 98 ucu için e2e regresyon (gerçek PostgreSQL/RLS + Redis), worker, iyzico (sahte sunucu), hız sınırı; birim testleri SOAP/WhatsApp/KMS/log/filtre
- [x] Kapsam eşikleri (birim saf katmanlar fn %95, e2e fn %90); prebuild kapıları; Docker imajları testlerden geçmeden oluşmaz
- [x] `npm run verify` (izole Docker, Node 24), `stack:dev` → arayüz testleri, CI: verify → ui → images, isteğe bağlı pre-push kancası
- [x] Web: Playwright 4 ekran (telefon/tablet/laptop/büyük) sayfa + akış testleri; vitest birim
- [x] Duyarlı düzeltmeler: 20 ızgaraya temel sütun, iş kutusu/genel bakış telefonda, tablolarda sabit ilk sütun, tablette hesap menüsü katmanı
- [ ] Görsel karşılaştırma (ekran görüntüsü farkı) — tasarım oturunca

### Faz 3 — Web (sonraki tur)
- [ ] `src/features/<context>/` yapısı, TanStack Query, contracts tipleri
- [ ] BFF + HttpOnly çerez oturum; `localStorage` token kaldırılır; `ACCESS_TOKEN_TTL=15m`
- [ ] Nonce'lu CSP

### Faz 4 — Mobil (Expo)
- [ ] İskelet, giriş (refresh + SecureStore + biyometri), iş kutusu, bildirimler, tebligat, SGK rapor onayı, push (PII'sız)

### Faz 5 — Gözlemlenebilirlik
- [ ] OpenTelemetry, Prometheus, Grafana, Loki (compose profili)

## Geçiş istisnaları (context sınırı)

Import düzeyinde ihlal yok (`arch:check`). Aşağıdakiler başka context'in **tablosunu doğrudan okuyor**; dokunurken o context'in `index.ts`'ine sorgu facade'ı ekleyip ona geçin, sonra listeden silin:

- `workspace` → `sgkReport`, `employmentEvent`, `sgkWorkplace` (inbox, dashboard, reports), `subscription` (inbox, dashboard), `eTebligat` (reports), `taxCalendarEvent` (dashboard)
- `notifications` → `eTebligat` (hatırlatıcılar), `user` (alıcılar)
- `payroll` → `sgkWorkplace`, e-Bildirge belgeleri (mutabakat)
- `taxpayers` → `subscription` (kota kontrolü)
- `assistant`, `documents` → `user` (ad soyad)
- Bilinçli olarak serbest: `company` ve `tenant` tablolarına salt okuma JOIN'leri (büro kapsamı her yerde gerekir).

## Bilinen açıklar / notlar

- `tebligat.imported` ve `sgk.reports.received` olayları verinin yazıldığı transaction'ın dışında yayınlanıyor (çökme anında bildirim kaybolabilir); düzeltme ve diğer taktik borçlar: [docs/03-taktiksel-tasarim/06-taktik-borc.md](../03-taktiksel-tasarim/06-taktik-borc.md).
- `npm audit`: exceljs → uuid (orta seviye, kullandığımız yol etkilenmiyor); exceljs güncellemesi izlenecek.
- Migration SQL dosyaları depoda LF, Windows çalışma ağacında CRLF: Prisma checksum'ı dosyaya bağlı olduğundan farklı işletim sistemlerinden aynı veritabanına migration uygulamayın (Docker `migrate` servisi kullanın).
- `hkazaz/docker/hakan` eski Docker denemesi; yerini `infra/docker` aldı (o klasör başka ekip üyesine ait, değiştirilmedi).

## Ürün tarafında açık işler (README'den)

iyzico canlı; SGK 4A canlı istemci; SGK canlı pilot; eklentinin gerçek GİB sayfasında doğrulanması + resmi tatil/süre uzatımı takvimi; Meta WhatsApp canlı; e-Fatura entegratör API'si; gerçek bordro çıktılarıyla doğrulama; Claude API canlı + KVKK metni.
