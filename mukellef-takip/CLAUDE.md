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
- @docs/ai/roadmap.md — fazlar ve **şu anki durum** (işe başlamadan bak)
- Mimari kararlar: `docs/adr/` · API uçları ve entegrasyon ayrıntıları: `README.md`

## Yapı

```
apps/api        NestJS 12 modüler monolit (HTTP: src/main.ts, kuyruk/zamanlayıcı: src/worker.ts)   → apps/api/CLAUDE.md
apps/web        Next.js 16 App Router + Tailwind 4                                             → apps/web/CLAUDE.md
apps/mobile     (Faz 4) Expo / React Native — henüz kod yok                                   → apps/mobile/CLAUDE.md
apps/extension  Chrome MV3 eklentisi: kullanıcının açtığı GİB/SGK sayfasındaki tabloyu API'ye gönderir
infra/docker    Dockerfile'lar ve compose (dev / prod)
docs/           ai/ (Claude bağlamı), adr/ (karar kayıtları)
```

## Çalıştırma

```bash
npm install
npm run stack:dev          # Docker: postgres, redis, openbao, api, worker, web (mock dış servisler)
# veya yalnız altyapı + yerelde uygulama:
npm run db:up && npm run dev:api && npm run dev:web
npm test -w api            # birim testler (vitest)
npm run test:e2e -w api    # e2e (tenant izolasyonu vb., Docker gerekir)
npm run lint -w api && npm run arch:check -w api   # oxlint + dependency-cruiser katman kuralları
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

## Dil ve üslup

- Kullanıcı arayüzü metinleri, kod yorumları, commit mesajları ve dokümanlar **Türkçe**. Kod tanımlayıcıları İngilizce (sözlük: `docs/ai/bounded-contexts.md`).
- Yeni özellik → `apps/web/src/content/faq.ts` (SSS) ve `changelog.ts` (Yenilikler) güncellenir.
- Doğrulanmamış entegrasyon (canlı SGK/GİB/WhatsApp) README'de "doğrulanmadı" olarak işaretli kalır; varsayımı gerçekmiş gibi yazma.
