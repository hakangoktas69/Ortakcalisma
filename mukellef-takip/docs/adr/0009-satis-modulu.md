# 0009 — Satış modülü: ayrı uygulama, ayrı veritabanı rolü

- **Durum:** Kabul (2026-10-20, Ferhat ve Hakan Kazaz), uygulama `satis/`
- **Bağlam:** Mali müşavirler kendi kendine kayıt olmaz. Bilgiler müşavirden ya da satış ekibinden gelir; satış ekibi büro hesabını açar, müşaviri arayıp kurulum ve eğitim verir. İleride bayi portalı ve sistem yönetimi portalı da gelecek. Bu ekranlar bütün büroları görür; müşavir portalının içine konursa bir yetki hatası, bir müşavirin bütün bürolara erişmesi demektir.
- **Karar:**
  - Satış, müşavir uygulamasından **fiziksel olarak ayrı** bir uygulamadır: `satis/api` (NestJS, `/api/satis`) ve `satis/web` (Next.js, `/satis`), ayrı Docker imajları.
  - **Aynı veritabanı, ayrı rol:** `mukellef_satis` → `sales_user`. Yetkiler migration `satis_modulu`'ndaki `sales_grant_access()` ile verilir: büro hesabı tabloları (`Tenant`, `User`, `Subscription`), denetim kaydına ekleme, kendi tabloları (`SalesUser`, `SalesAccount`, `SalesAuditLog`) ve `Company` tablosunda **yalnız** `id`, `tenantId`, `isActive` kolonları (mükellef sayısı için). Mükellef, beyanname, SGK, fatura vb. tablolara erişim veritabanında reddedilir. RLS'te `sales_user` için ayrı politika vardır (büro bağlamı kurmadan tüm bürolar).
  - Müşavir rolü (`app_user`) satış tablolarını göremez.
  - **Satış kullanıcıları** (`SalesUser`) büro kullanıcılarından (`User`) ayrı tablodadır; bir büro hesabı hiçbir yolla satış yetkisi kazanamaz. İki adımlı doğrulama zorunludur (kurmadan oturum açılmaz). Tek yetki seviyesi.
  - **Ayrı sırlar:** oturum anahtarı (`satis_jwt_secret`), şifreleme anahtarı (`satis_vault_key`, satışçıların TOTP anahtarları için). Satış API'si müşavir API'sinin anahtarlarını almaz; müşavirin şifrelediği kurum şifrelerini çözemez.
  - **Oturum** HttpOnly + SameSite=Strict çerezde (`/api/satis` yolu); `localStorage`'da anahtar yok. CSRF: veri değiştiren istekte `X-Satis: 1` başlığı ve Origin denetimi; CORS kapalı.
  - **Ortak çekirdek:** şifre özeti, TOTP, denetim zinciri, paket tablosu ve Prisma istemcisi `apps/api`'den derleme anında alınır (`satis/api/src/core.ts`, tek geçiş noktası). Satışın açtığı müşavir hesabı müşavir sitesinde aynı şifre ve 2FA kurallarıyla giriş yapar; denetim kaydı aynı zinciri sürdürür. Prisma şeması ve migration geçmişi tektir (`apps/api/prisma/schema/sales.prisma`).
  - Büroyu etkileyen her satış işlemi iki yere yazılır: satış zinciri (`SalesAuditLog`) ve büronun kendi `AuditLog`'u (müşavir kendi kaydında görür).
  - **Dondurma** müşavir koduna dokunmadan yapılır: aktif kullanıcılar kapatılır (`isActive=false`, oturumlar düşer), liste `SalesAccount.suspendedUserIds`'te tutulur; açılınca yalnız bunlar geri açılır.
  - Renk: müşavir portalı mavi, satış turuncu, sistem yönetimi (ileride) koyu gri.
- **Sonuç:**
  - Satış API'sindeki bir hata mükellef verisini sızdıramaz (veritabanı reddeder); müşavir API'sindeki bir hata satış kullanıcılarını gösteremez.
  - `apps/api`'deki ortak dosyaların imzası değişirse `satis/api` de derlenir (CI ve `npm run verify` ikisini birlikte denetler).
  - Mevcut veritabanında (init betiği çalışmış) `sales_user` yoksa ve migration rolünün CREATEROLE yetkisi yoksa migration yalnız uyarı verir; yönetici `CREATE ROLE sales_user NOLOGIN; SELECT sales_grant_access();` ve `mukellef_satis` giriş rolünü açar (infra/docker/README.md).
- **Açık konular:** GİB kullanıcı bilgisi formda yok (proje kuralı 3: GİB şifresi saklanmaz; ekip kararı bekleniyor). Satış anahtarı üretimde henüz OpenBao'dan gelmiyor (uyarı verir). Bayi portalı (bayi kendi müşavirlerini görür) ve sistem yönetimi portalı aynı desenle eklenecek.
