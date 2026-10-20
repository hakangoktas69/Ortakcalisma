# 5.4 Tuzaklar ve sık sorular

> Her madde bu projede gerçekten yaşanmış bir sorundan gelir. Yeni bir tuzağa düştüysen buraya ekle.

## Veritabanı ve RLS

**Sorgu boş dönüyor ama veri var.**
Sorgu RLS bağlamı dışında çalışıyor. Olası nedenler:
- Prisma sorguları tembeldir (`.then` çağrılınca çalışır). `runAsTenant(id, () => this.prisma.x.findMany())` güvenlidir: dönen sorgu bağlamın içinde başlatılır. Ama sorguyu bir nesne/dizi içinde döndürürsen (`() => ({ rows: this.prisma.x.findMany() })`) çağıranın `await`'inde, **bağlam dışında** başlar. Kural: birden çok sorgu varsa `async () => { const a = await …; const b = await …; return { a, b }; }` biçimini kullan.
- Worker/zamanlanmış işte bağlam kurulmamış → `runAsTenant` ile sar.
- Yerelde süper kullanıcıyla bağlanıyorsan tersi olur: RLS **hiç** çalışmaz ve her şey görünür. Uygulama `mukellef_app` rolüyle bağlanmalı (`npm run dev:env`).

**`permission denied for table AuditLog`.**
Doğru davranış: uygulama rolü denetim kaydını güncelleyemez/silemez. Testte temizlik gerekiyorsa owner bağlantısını (`t.db`) kullan.

**Migration checksum hatası.**
Uygulanmış migration dosyası değişmiş (çoğunlukla Windows'ta CRLF). Dosyayı geri al (`git checkout -- <dosya>`); migration'ları Docker `migrate` servisiyle uygula ve farklı işletim sistemlerinden aynı veritabanına migration uygulama. Depoda dosyalar LF'dir; `.gitattributes` şu an `*.sql` için LF zorlamaz (Windows çalışma ağacında CRLF olabilir) — yeni migration'ı LF ile kaydet.

**Benzersizlik ihlali 500 değil 409 dönüyor — neden?**
`PrismaExceptionFilter` P2002 → 409, P2025 → 404, P2003 → 409, P2000 → 400 çevirir. İş anlamı olan bir çakışmada yine de kendi mesajını at (`ConflictException('Bu VKN ile kayıtlı mükellef var')`).

## Ortam ve araçlar

**`npm test` yerelde Prisma hatası veriyor.**
Node 20 Prisma 7 için eski. Node 24 kur ya da `npm run verify` (Docker'da çalışır).

**Uygulama açılmıyor: "Yapılandırma hatası …".**
Bilerek: zod doğrulaması zayıf/eksik ayarla başlamayı reddeder. Mesaj hangi değişkenin sorunlu olduğunu söyler. Geliştirmede `npm run dev:env` çıktısını kullan; `RATE_LIMIT=off` yalnız testte geçerlidir.

**Testler 429 (Too Many Requests) alıyor.**
E2E test uygulaması `RATE_LIMIT=off` ile açılır (`bootApp`); hız sınırını test eden tek dosya `throttle.e2e-spec.ts`'dir. Kendi `bootApp(...)` çağrında bu ayarı ezme.

**`http://127.0.0.1:8080` boş sayfa / bağlanamıyor.**
`docker compose ps` ile servisleri kontrol et; `migrate` bitmeden api açılmaz. Geliştirmede Caddy `SITE_ADDRESS=":80"` ile her host adını kabul eder. Kod değiştiyse `npm run stack:dev` imajları yeniden derler; yalnız ayar değiştiyse `--force-recreate` gerekir.

**Giriş yapamıyorum (demo).**
5 hatalı denemede hesap 15 dakika kilitlenir, IP ayrıca hız sınırına takılır. Bekle ya da owner bağlantısıyla `User.failedLogins` / `lockedUntil` alanlarını sıfırla (yalnız geliştirme).

**Playwright Windows'ta "dosya kilitli" hatası.**
`test-results` klasörünü başka süreç (gezgin, antivirüs) tutuyor. `npm run test:ui` Docker içinde koşar; yerelde çalıştıracaksan çıktı klasörünü geçici dizine yönlendir.

**Next derlemesi "bailout to client-side rendering" hatası.**
`useSearchParams` kullanan istemci bileşeni `<Suspense>` sınırı olmadan render ediliyor. Panel yerleşimi çocukları zaten `<Suspense>` ile sarar; yeni bir kök yerleşim eklersen sen de sar.

**Web tip kontrolü `LayoutProps` / `PageProps` bulamıyor.**
Bu tipler `next typegen` ile üretilir; `npm run typecheck -w web` önce onu çalıştırır. Doğrudan `tsc` çalıştırma.

## Tasarım soruları

**Neden ayrı repository sınıfları yok?** → [Yapı taşları](../03-taktiksel-tasarim/02-yapi-taslari.md#neden-ayrı-repository-sınıfı-yok)

**İki bağlamı aynı transaction'da güncellemem gerekiyor.**
Önce sınırı sorgula. Çoğu durumda biri asıl değişiklik, diğeri yan etkidir → olay. Gerçekten atomik olmalıysa iki aggregate aynı bağlama ait olabilir. Mimara danış, karar ADR'ye.

**Yeni bir alt bağlam mı, mevcut bağlama özellik mi?**
Kendi terimleri, kuralları ve verisi varsa ve başka bağlamın modelini bozmadan büyüyecekse ayrı bağlam. Yalnız yeni bir ekran/rapor ise muhtemelen `workspace` okuma modeli. → [Tarifler §I](02-tarifler.md#i-yeni-bounded-context)

**Mikroservise ne zaman geçeriz?**
Ölçüm gerektirdiğinde ve yalnız ayrışan bağlam için. → [Çalışma zamanı: ölçekleme yolu](../04-mimari/01-calisma-zamani.md#ölçekleme-yolu), [ADR 0001](../adr/0001-moduler-monolit.md)

**GİB'e otomatik giriş yapıp beyannameleri çekebilir miyiz?**
Hayır (bilinçli karar): GİB kullanıcı adı/şifresi saklanmaz ve sunucudan GİB'e giriş yapılmaz. Veri, kullanıcının kendi tarayıcı oturumundan Chrome eklentisiyle gelir. → [data-intake](../02-baglamlar/data-intake.md), [security-kvkk.md](../ai/security-kvkk.md)

**Claude'a (asistana) mükellef verisini gönderebilir miyiz?**
Hayır. Asistan yalnız kullanıcının yazdığı soruyu, maskelenmiş olarak ve büro onayıyla gönderir. → [assistant](../02-baglamlar/assistant.md)
