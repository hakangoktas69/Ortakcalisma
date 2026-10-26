# Terimler sözlüğü

Belgelerde sık geçen teknik terimlerin kısa, sade açıklaması. İş terimlerinin kod karşılıkları (mükellef = `Taxpayer` gibi): [ai/mimari.md, "Ortak dil"](../ai/mimari.md#ortak-dil-tr--kod).

| Terim | Açıklama | Bu projede |
|---|---|---|
| **Kiracı (tenant)** | Sistemi kullanan, verisi diğerlerinden ayrı tutulan müşteri | Mali müşavir ofisi; her kayıtta `org_id` |
| **SaaS** | Kullanıcının kurmadığı, sunucuda çalışan yazılım | Eworks; kullanıcı yalnız tarayıcı kullanır |
| **Bounded context (bağlam)** | Kendi kuralları ve sözcükleriyle ayrı tutulan iş alanı | `packages/contexts/<ad>`: portfolio, tax-filing, sync… ([DDD nedir](ddd-nedir.md)) |
| **Domain / application / infrastructure** | Bir bağlamın katmanları: iş kuralı / kullanım senaryosu / veritabanı ve dış dünya | `src/domain` saf kalır, veritabanı bilmez |
| **Public API (`index.ts`)** | Bir bağlamın dışarıya açtığı tek kapı | Başka bağlam yalnız buradan çağırır |
| **BFF (Backend for Frontend)** | Tarayıcıyla iş katmanı arasındaki sunucu tarafı | `apps/web/src/app/api`, `src/bff`: oturum, CSRF, yetki denetimi |
| **ACL (Anti-Corruption Layer)** | Dış sistemin (GİB) dilini bizim dilimize çeviren katman | `services/integration` (Python); çıktısı `contracts/` |
| **Robot** | Kurum sitesini tarayıcıyla, insan gibi tıklayarak kullanan program | Playwright; GİB girişi ve ekranları |
| **Servis yolu** | Oturum açıldıktan sonra kurumun isteklerini doğrulanmış HTTP ile göndermek (resmi web servis değil) | D38: `GIB_ERISIM_YOLU` = `robot` \| `servis` |
| **RLS (Row Level Security)** | Veritabanının, kullanıcının yalnız kendi satırlarını görmesini sağlaması | Her kiracı tablosunda; başka ofisin kaydı görünmez |
| **Shard** | Büyük veritabanını parçalara bölmek; her ofis bir parçada | `db-shard-01`, `db-shard-02` |
| **Migration** | Veritabanı şemasını sırayla değiştiren SQL dosyası | `supabase/migrations`; uygulanan migration değişmez |
| **pgTAP** | Veritabanı içinde koşan testler | RLS ve yetki kuralları `supabase/tests` |
| **Outbox** | Kuyruğa gidecek mesajı veriyle aynı işlemde veritabanına yazıp sonra göndermek; mesaj kaybolmaz | `sync.outbox` → işçi → RabbitMQ |
| **Kuyruk (RabbitMQ)** | İşlerin sırayla ve güvenle iletildiği ara sistem | Web iş ister, entegrasyon işçisi alır |
| **Vault** | Şifrelerin şifreli saklandığı kasa | Kurum (GİB) şifreleri yalnız burada |
| **CSRF** | Başka siteden kullanıcı adına istek gönderme saldırısı | Değişiklik isteklerinde köken denetimi |
| **TDD** | Önce testi yaz (kırmızı), sonra kodu (yeşil) | [TDD nedir](tdd-nedir.md); özellikler kırmızı başlar |
| **Kabul testi (e2e)** | Uygulamayı tarayıcıda kullanıcı gibi kullanan test | `apps/web/e2e`, dört ekran boyutu |
| **Özellik anahtarı** | Her işlemin adı; hem yetki hem test durumu buna bağlı | `packages/feature-registry`, örn. `beyanname.senkron.start` |
| **Sahte GİB** | GİB'i taklit eden yerel sunucu; gerçek veri yok | Demo ve testler buna gider (D33: canlı ayrıca doğrulanır) |
| **Container / imaj** | Uygulamanın çalışması için gereken her şeyin paketlendiği kutu / kalıbı | Docker; `node tools/deploy/yigin.mjs` yönetir |
| **Compose** | Birden çok container'ı birlikte çalıştırma tanımı | `deploy/compose/compose.yml` |
