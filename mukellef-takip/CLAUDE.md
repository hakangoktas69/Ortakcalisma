# Mükellef Takip — Claude proje belleği

Mali müşavir bürolarının mükelleflerini (firma) izlediği çok kiracılı (multi-tenant) SaaS: beyanname kontrolü, e-Defter, e-Tebligat, SGK (Vizite, 4A, e-Bildirge), fatura/KDV ön kontrol, bordro mutabakatı, bildirimler, dilekçe, yapay zekâ asistanı. Kişisel veri (TCKN, sağlık raporu) ve kurum şifreleri işlendiği için **KVKK ve GİB/SGK gereği yüksek güvenlik** temel tasarım kısıtıdır.

Bu dosya ve aşağıda içe aktarılan belgeler takımın ortak Claude bağlamıdır; git'e girer. Mimari, güvenlik kuralı veya teknoloji kararı değiştiğinde **aynı değişiklikte** ilgili `docs/ai/*.md` ve gerekirse yeni bir `docs/adr/` kaydı güncellenir.

## Ayrıntılı bağlam

- @docs/ai/vision.md — ürün, kullanıcı, kapsam dışı
- @docs/ai/architecture.md — modüler monolit, DDD katmanları, event/outbox, bağımlılık kuralları
- @docs/ai/bounded-contexts.md — context haritası, aggregate'ler, eventler, TR↔EN terim sözlüğü
- @docs/ai/tech-stack.md — korunan / onaylı / yasaklı teknolojiler
- @docs/ai/security-kvkk.md — veri sınıflandırması, şifreleme, saklama/imha, tehdit modeli
- @docs/ai/conventions.md — kod, test, migration, dil, commit kuralları
- @docs/ai/testing.md — test katmanları, kapsam eşikleri, derleme kapıları (her değişiklikte uy)
- @docs/ai/roadmap.md — fazlar ve **şu anki durum** (işe başlamadan bak)
- Mimari kararlar: `docs/adr/` · API uçları ve entegrasyon ayrıntıları: `README.md`
- Geliştirici belgeleri (DDD stratejik/taktiksel tasarım, bağlam sayfaları, tarifler, tuzaklar): `docs/README.md` — bir bağlamda çalışmadan önce `docs/02-baglamlar/<context>.md`'yi, yeni uç/olay/tablo/context eklerken `docs/05-gelistirici-rehberi/02-tarifler.md`'yi oku. Kural, uç, olay veya sınır değişirse ilgili bağlam sayfasını aynı değişiklikte güncelle; borç kapanırsa `docs/03-taktiksel-tasarim/06-taktik-borc.md`'den sil.

## Ekip hafızası

Otomatik hafıza dizini `docs/ai/memory/`'dir; git'e girer ve ekipçe paylaşılır. Yönlendirmeyi SessionStart kancası `tools/claude/session-start.mjs` yapar: `.claude/settings.local.json` dosyasına `autoMemoryDirectory` yazar. Ayrıntı: `docs/05-gelistirici-rehberi/05-claude-code.md`.

- **Oturum başında:** bağlamda ekip hafızasının `MEMORY.md` içeriği yoksa (kanca çalışmamış, ilk oturum, kancalar kapalı) önce `docs/ai/memory/MEMORY.md`'yi oku. Ardından konuyla ilgili kayıtları aç; kullanıcıya kancanın çalışmadığını bir kez söyle.

- Önce doğru katmanı seç: kalıcı kural → `docs/ai/*.md`, karar → ADR, bağlam bilgisi → `docs/02-baglamlar/`, tuzak → `04-tuzaklar.md`. Hafızaya yalnız öğrenilmiş ve kodda görünmeyen bilgi yazılır; türü `feedback`, `project` ya da `reference` olur.
- **Kişiye özel tercih (`user` türü) ekip hafızasına yazılmaz** → `CLAUDE.local.md` (gitignore'da).
- Kişisel veri, sır, gerçek mükellef veya büro bilgisi hafızaya yazılmaz. Yazdıktan sonra `npm run memory:check` çalıştır.
- Kayıtlar `[[dosya-adı]]` ile bağlanır (Obsidian kasası: `docs/`). Beceriler: `/hafiza` (kaydet, aktar, denetle), `/oryantasyon` (yeni geliştirici).

## Yapı

```
apps/api        NestJS 12 modüler monolit (HTTP: src/main.ts, kuyruk/zamanlayıcı: src/worker.ts)   → apps/api/CLAUDE.md
apps/web        Next.js 16 App Router + Tailwind 4                                             → apps/web/CLAUDE.md
apps/mobile     (Faz 4) Expo / React Native — henüz kod yok                                   → apps/mobile/CLAUDE.md
apps/extension  Chrome MV3 eklentisi: kullanıcının açtığı GİB/SGK sayfasındaki tabloyu API'ye gönderir
satis/          Satış portalı (ayrı uygulama, ayrı DB rolü): api/ NestJS /api/satis, web/ Next.js /satis   → satis/CLAUDE.md
infra/docker    Dockerfile'lar ve compose (dev / prod)
docs/           ai/ (Claude bağlamı), ai/memory/ (ekip hafızası), adr/ (karar kayıtları) — Obsidian kasası
tools/claude    Claude Code kancası ve ekip hafızası denetimi
```

## Çalıştırma

```bash
npm install
npm run verify             # tam doğrulama (izole Docker): lint, tip, birim + API regresyon — her derlemeden önce
npm run stack:dev          # verify → kapılı imajlar → yığın → 4 ekranda arayüz testleri (http://localhost:8080)
# veya yalnız altyapı + yerelde uygulama:
npm run db:up && npm run dev:api && npm run dev:web
npm test                   # birim testleri (api kapsam eşikli + web)
npm run test:e2e           # API regresyon (gerçek PostgreSQL/Redis; Testcontainers ya da E2E_* adresleri)
npm run test:ui            # arayüz regresyonu (yığın ayaktayken)
npm run lint && npm run typecheck
```

## Pazarlıksız kurallar (ihlal eden değişiklik yapma; gerekiyorsa önce kullanıcıya sor)

1. **Tenant izolasyonu:** Her sorgu giriş yapan kullanıcının `tenantId`'si ile sınırlanır. Yeni tenant'lı tablo = `tenantId` kolonu + RLS politikası + izolasyon e2e testi.
2. **Kurum şifreleri** (SGK, ileride GİB/entegratör) yalnızca `platform/crypto` (KMS portu) ile şifreli saklanır, API yanıtında asla dönmez, her çözme `AuditLog`'a yazılır.
3. **GİB'e otomatik giriş / şifre saklama yok.** GİB verisi kullanıcının kendi oturumundan, eklentiyle ve önizleme (`dryRun`) → onay akışıyla gelir.
4. **Resmi kuruma yazan işlemler** (SGK çalışmazlık onayı, ileride bildirge gönderimi) yalnızca açık kullanıcı eylemiyle olur ve denetim kaydına yazılır; zamanlanmış iş yazma yapmaz.
5. **Kişisel veri log'a, hata mesajına, analitik/push yüküne veya LLM'e gitmez.** TCKN/VKN/IBAN/telefon/e-posta maskelenir (`redact.ts`, pino redaksiyonu). Sağlık verisi (e-Rapor) özel nitelikli kişisel veridir.
6. **Sırlar koda, `.env.example`'a, test fixture'ına, sohbete yazılmaz.** Zayıf/varsayılan sırla uygulama açılmaz (config doğrulaması).
7. **Katman kuralı:** `domain` Nest/Prisma import etmez; context'ler birbirine yalnız `index.ts` üzerinden erişir; yan etkiler domain event ile. `npm run arch:check` yeşil olmalı.
8. **HTTP sözleşmesi:** Mevcut route ve yanıt şekilleri web + eklenti tarafından kullanılır; kırıcı değişiklik `packages/contracts` güncellemesi ve istemci değişikliğiyle birlikte yapılır.
9. Tutar, kota, lisans gibi kararlar **sunucuda** hesaplanır; istemciden gelen değere güvenilmez.
10. **Testsiz değişiklik yok:** yeni uç → e2e (büro izolasyonu dahil), yeni kural → birim, yeni sayfa → `PANEL_ROUTES`. Kapsam eşiklerini düşürme; `npm run verify` yeşil olmadan derleme/dağıtım yapılmaz (docs/ai/testing.md).
11. **Duyarlı arayüz:** telefon 375 → büyük ekran 1920 desteklenir; kurallar `apps/web/CLAUDE.md`, sınaması `apps/web/e2e`.

## Dil ve üslup

- Kullanıcı arayüzü metinleri, kod yorumları, commit mesajları ve dokümanlar **Türkçe**. Kod tanımlayıcıları İngilizce (sözlük: `docs/ai/bounded-contexts.md`).
- Yeni özellik → `apps/web/src/content/faq.ts` (SSS) ve `changelog.ts` (Yenilikler) güncellenir.
- Doğrulanmamış entegrasyon (canlı SGK/GİB/WhatsApp) README'de "doğrulanmadı" olarak işaretli kalır; varsayımı gerçekmiş gibi yazma.
