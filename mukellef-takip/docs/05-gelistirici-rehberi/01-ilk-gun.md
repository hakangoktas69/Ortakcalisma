# 5.1 İlk gün

> Önce: [Genel bakış](../00-genel-bakis.md), [Ortak dil](../01-stratejik-tasarim/02-ortak-dil.md) · Sonra: [Tarifler](02-tarifler.md)

## Gerekenler

| Araç | Sürüm | Not |
|---|---|---|
| Docker Desktop / Engine + Compose v2 | güncel | Yığın ve testler container'da koşar |
| Node.js | **24** | Prisma 7 eski Node'la çalışmaz; yalnız Docker kullanacaksan şart değil |
| Git | — | Windows'ta `core.autocrlf` açıksa migration dosyalarına dikkat ([Tuzaklar](04-tuzaklar.md)) |
| VS Code + Claude Code | — | Proje bağlamı `CLAUDE.md` + `docs/ai/` + ekip hafızası otomatik yüklenir; ilk oturumda `/oryantasyon` ([5.5](05-claude-code.md)) |
| Obsidian | isteğe bağlı | `docs/` klasörünü kasa olarak açın |

## 1. Tüm sistemi ayağa kaldır (önerilen)

```bash
cd mukellef-takip
npm install
npm run stack:dev
```

Bu komut sırasıyla: geliştirme sırlarını üretir → **tüm testleri** yalıtılmış Docker'da çalıştırır (`verify`) → imajları derler → yığını başlatır → arayüz testlerini (4 ekran boyutu) koşar. İlk sefer birkaç dakika sürer.

- Adres: **http://127.0.0.1:8080**
- Demo giriş: `demo@mukellef.test` / `Demo1234!` (yönetici)
- Dış servisler (SGK, GİB, WhatsApp, iyzico, Claude) **demo/mock** modundadır; hiçbir gerçek kuruma istek gitmez.

Durdur: `npm run stack:down` · Loglar: `npm run stack:logs`

## 2. Hızlı geliştirme döngüsü (yerel süreçler)

```bash
npm run db:up                       # yalnız postgres + redis (Docker)
npm run dev:env > apps/api/.env     # yerel bağlantı ayarları (yalnız geliştirme sırları)
cd apps/api && DATABASE_URL="$MIGRATE_DATABASE_URL" npx prisma migrate deploy && cd ../..
npm run dev:api                     # http://localhost:4000 (izleme modu)
npm run dev:worker                  # kuyruk + zamanlanmış işler (gerekirse)
npm run dev:web                     # http://localhost:3000
```

> `.env` dosyalarını commit etme; Claude Code bu dosyaları okuyamaz (`.claude/settings.json`).

## 3. Kod tabanında yön bul

| Ne arıyorsun? | Nereye bak |
|---|---|
| Bir ekranın arkasındaki uç | `apps/web/src/components/<Ekran>View.tsx` → `api("/api/...")` → `apps/api/src/modules/<context>/interface/http/*.controller.ts` |
| Bir iş kuralı | `modules/<context>/domain/` (yoksa `application/`) — bağlam sayfasındaki "İş kuralları" |
| Hangi bağlam? | [Bağlam kataloğu](../02-baglamlar/README.md), terim → [Ortak dil](../01-stratejik-tasarim/02-ortak-dil.md) |
| Veritabanı tablosu | `apps/api/prisma/schema/<context>.prisma` |
| Bir olayın dinleyicisi | `grep -r "OnDomainEvent(" apps/api/src` |
| Bir uçun testi | `apps/api/test/*.e2e-spec.ts` (bağlam sayfasındaki "Testler") |

## 4. İlk değişiklik (alıştırma)

Hedef: iş kutusunda "yaklaşan" eşiğini anlamak — kod okumak, test yazmak ve kapıdan geçmek.

1. [workspace](../02-baglamlar/workspace.md) sayfasını oku; `apps/api/src/modules/workspace/domain/inbox-items.ts` içinde `severityForDue`'yu bul.
2. Yanındaki `inbox-items.spec.ts`'e bir sınır durumu testi ekle (ör. son gün tam bugün).
3. Çalıştır:
   ```bash
   npm run test -w api -- inbox-items     # tek dosya, saniyeler
   npm run lint                           # lint + mimari sınırlar + web lint
   npm run typecheck
   ```
4. Push'tan önce: `npm run verify` (tüm kapı). İstersen kancayı kur: `npm run hooks:install` (push öncesi otomatik).
5. Değişiklik bir kuralı değiştiriyorsa ilgili bağlam sayfasını da güncelle.

## 5. Kurallar — ilk gün bilinmesi gerekenler

1. Başka bağlamın **iç dosyasını** import etme; yalnız `index.ts`. (`npm run lint` yakalar.)
2. Kişisel veriyi (TCKN, ad, sağlık) **log'a, hata mesajına, olaya fazladan, WhatsApp'a, LLM'e** koyma.
3. Kişi alanlarını yazarken/okurken `PersonalDataService` kullan.
4. Yeni uç → guard (`AuthGuard`, gerekirse `AdminGuard`), DTO ve e2e testi (çapraz büro dahil).
5. Arayüz metni Türkçe; yeni özellik → `apps/web/src/content/changelog.ts`, gerekirse `faq.ts`.
6. Commit/push öncesi `npm run verify` yeşil olmalı. Ayrıntı: [Kod inceleme listesi](03-kod-inceleme.md).

## Yardım

- Claude Code'a sor: "tebligat bağlamında olay nasıl yayınlanıyor?" — `CLAUDE.md` ve bu belgeleri bilir.
- Takıldığın konu [Tuzaklar](04-tuzaklar.md)'da yoksa ekle.
