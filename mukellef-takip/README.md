# Mükellef Takip

Mali müşavirler için mükellef takip portalı. Kişisel veri ve kurum şifresi işlediği için KVKK ve GİB/SGK gereği yüksek güvenlikli tasarlanmıştır.

**Geliştirici belgeleri (junior / senior / mimar okuma yollarıyla):** [docs/README.md](docs/README.md) — iş alanı, DDD bağlam haritası, 13 bounded context, taktiksel tasarım, mimari, tarifler.
**Mimari, güvenlik kuralları ve yol haritası (kısa):** [CLAUDE.md](CLAUDE.md) ve [docs/ai/](docs/ai/) (karar kayıtları: [docs/adr/](docs/adr/)). Docker ile çalıştırma ve işletim: [infra/docker/README.md](infra/docker/README.md).

## Yapı

```
apps/
  api/        NestJS modüler monolit (DDD): src/main.ts (HTTP) + src/worker.ts (kuyruk, zamanlayıcı, outbox)
              src/modules/<context>/{domain,application,infrastructure,interface}, src/platform, src/shared-kernel
  web/        Next.js + Tailwind
  mobile/     (Faz 4) Expo — henüz kod yok
  extension/  Chrome eklentisi: GİB/SGK sayfasından aktarma (bkz. apps/extension/README.md)
infra/docker/ Dockerfile'lar, compose (dev / prod), Caddy, OpenBao, yedek
docs/         README.md (geliştirici belgeleri dizini), 00–05 numaralı bölümler, ai/ (Claude ve ekip bağlamı), adr/ (mimari kararlar)
```

### Arayüz

- Ana renk `brand` (indigo) ve kenar çubuğu rengi `ink`, `apps/web/src/app/globals.css` içinde tanımlı; yazı tipi Plus Jakarta Sans.
- Koyu tema: Tailwind renk ölçekleri `.dark` altında ters çevrilir; koyu lacivert alanlar `class="ink"` ile her iki temada aynı kalır. Bu bloklar `node apps/web/scripts/gen-theme.mjs` ile üretilir. Tema tercihi (açık / sistem / koyu) kenar çubuğunun altından seçilir.
- Kabuk bileşenleri `apps/web/src/components/shell/`: dar ikon menüsü (`nav.ts`: `rail` / `help` / `account` alanları), Ctrl+K / "/" komut paleti (sayfa, işlem ve mükellef arama), giriş ekranı kabuğu. Varsayılan tema açık; koyu ve "sistem" hesap menüsünden seçilir.
- **İş kutusu** (`/`, `GET /api/inbox`): açık işler saklanmaz, her açılışta beyanname kontrolü, incelenmemiş tebligatlar, onay bekleyen e-raporlar, e-Defter beratları, bordro mutabakatı ve lisans süresinden üretilir (`apps/api/src/modules/workspace`). Her işin kararlı bir anahtarı vardır (ör. `decl:<firma>:KDV1:2026-09`); "Sonra hatırlat" bu anahtarla `InboxSnooze` tablosuna büro genelinde yazılır (`POST /api/inbox/snooze`, `/unsnooze`). Eski özet ekranı `/ozet` (Genel bakış).
- **Sıkça sorulanlar** (`/sss`) ve **Yenilikler** (`/yenilikler`) içerikleri kodla birlikte sürümlenir: `apps/web/src/content/faq.ts` ve `changelog.ts`. Bir özellik değişince SSS cevabını güncelleyin; yeni sürümde `CHANGELOG` dizisinin başına kayıt ekleyin. Kullanıcı en yeni kaydı görmediyse menüde "Yenilikler"in yanında işaret yanar. SSS soruları `/sss#soru-id` bağlantısıyla doğrudan açılabilir.

## Çalıştırma

Docker açık olmalı. Proje klasöründe:

```bash
npm install
npm run stack:dev     # bütün sistem container'larda → http://localhost:8080 (demo verisiyle)
```

Kodu container dışında, sıcak yeniden yüklemeyle geliştirmek için `npm run db:up` + `npm run dev:api` / `dev:worker` / `dev:web` (ayrıntı: [infra/docker/README.md](infra/docker/README.md#geliştirme)). Üretim kurulumu, OpenBao, yedek ve geri yükleme de orada.

Demo giriş bilgileri (yönetici ve personel) `apps/api/prisma/seed.ts` dosyasının başında. Seed her çalıştığında veriler sıfırlanır (Docker'da yalnız veritabanı boşken çalışır).

Kontroller: `npm test` (birim), `npm run test:e2e -w api` (büro izolasyonu, RLS, oturum; Docker gerekir), `npm run lint` (oxlint + katman kuralları + web).

## API uçları

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/api/auth/login` | E-posta + şifre → `{ accessToken, refreshToken }`; 2FA açıksa `{ mfaRequired, mfaToken }` (5 dk). IP başına dakikada 10 deneme |
| POST | `/api/auth/login/2fa` | Doğrulayıcı kodu veya kurtarma kodu → `{ accessToken, refreshToken }` |
| POST | `/api/auth/password-reset/request` · `/confirm` | Şifremi unuttum: e-posta ya da cep telefonuna 6 haneli kod (10 dk, 5 deneme) → yeni şifre; oturumlar düşer, 2FA korunur. `PASSWORD_RESET_MODE=mock` iken kod gönderilmez, geliştirmede yanıtta döner (doğrulanmadı: gerçek e-posta/SMS sağlayıcısı yok) |
| POST | `/api/auth/refresh` | Yenileme anahtarı → yeni erişim + yenileme anahtarı (tek kullanımlık; tekrar kullanılırsa bütün oturum ailesi kapanır) |
| POST | `/api/auth/logout` | Bu cihazın oturumunu kapatır |
| GET / DELETE | `/api/auth/sessions` | Açık cihaz oturumları / `/:id` uzaktan kapatma |
| GET | `/api/health` | Sağlık kontrolü (oturumsuz, ayrıntı vermez) |
| POST | `/api/auth/password` | Şifre değiştir (diğer oturumlar düşer) |
| POST | `/api/auth/2fa/setup` · `/enable` · `/disable` | İki adımlı doğrulama kurulumu (QR), açma (kurtarma kodları bir kez), kapatma |
| GET/POST/PATCH | `/api/users` | Kullanıcı yönetimi (yönetici): ekle (geçici şifre), rol, devre dışı, `/:id/reset-password`, `/:id/reset-2fa` |
| GET/POST | `/api/companies/import` | Excel/CSV firma aktarımı (yönetici; `?dryRun=false` olmadan yazmaz); `/import/template` şablon |
| GET/POST | `/api/billing` | Lisans durumu, paketler; `/checkout` (iyzico'da ödeme sayfası adresi döner), `/payments/:id/refresh`, `/demo-confirm`, `/cancel` (yönetici) |
| GET/PUT | `/api/billing/profile` | Fatura bilgileri (iyzico alıcı bilgisi) |
| POST | `/api/billing/iyzico/callback` | iyzico geri dönüşü (oturumsuz; token'la iyzico'ya sorar, portala yönlendirir) |
| GET | `/api/auth/me` | Giriş yapan kullanıcı |
| GET | `/api/companies?q=&type=` | Firma listesi (arama, tür filtresi) |
| POST | `/api/companies` | Firma ekle (lisans ve kota kontrolü) |
| PATCH | `/api/companies/:id` | Firma güncelle / aktif-pasif |
| GET | `/api/dashboard/summary` | Dashboard özeti |
| GET | `/api/sgk/workplaces` | SGK işyerleri (şifre asla dönmez) |
| POST | `/api/sgk/workplaces` | İşyeri / şube ekle |
| PUT | `/api/sgk/workplaces/:id/vizite-credentials` | Vizite bilgileri: önce SGK'da denenir, sonra şifreli kaydedilir |
| DELETE | `/api/sgk/workplaces/:id/vizite-credentials` | Vizite bilgilerini sil |
| PUT | `/api/sgk/workplaces/:id/tescil-credentials` | 4A bilgileri (kullanıcı adı, sistem ve işyeri şifresi): önce doğrulanır, sonra şifreli kaydedilir |
| DELETE | `/api/sgk/workplaces/:id/tescil-credentials` | 4A bilgilerini sil |
| POST | `/api/sgk/sync?workplaceId=` | Tek işyerini hemen senkronla (Vizite + 4A); parametresiz: tüm işyerlerini kuyruğa al |
| GET | `/api/sgk/employment?type=&days=` | İşe giriş / işten çıkış kayıtları (ENTRY / EXIT) |
| GET | `/api/sgk/ebildirge?months=&period=&workplaceId=` | Aktarılmış e-Bildirge (aylık prim ve hizmet) belgeleri |
| GET | `/api/sgk/reports?status=` (PENDING / APPROVED) | e-Rapor listesi |
| POST | `/api/sgk/reports/:id/approve` | Çalışmazlık bildirimi (SGK'ya yazar) |
| GET | `/api/declarations/control?month=2026-09` | Beyanname kontrol matrisi ve tür bazında özet (varsayılan: önceki ay) |
| POST | `/api/declarations/sync?month=` | GİB'den verilmiş beyannameleri çek (elle girilenlerin üzerine yazmaz) |
| POST | `/api/declarations` | Beyannameyi elle "verildi" işaretle |
| DELETE | `/api/declarations/:id` | Elle işareti geri al (GİB kaydı silinemez) |
| GET/PUT | `/api/companies/:id/obligations` | Firmanın beyanname yükümlülükleri |
| POST | `/api/invoices/import?dryRun=` | UBL-TR fatura dosyaları (`files`: .xml / .zip); varsayılan önizleme |
| GET | `/api/invoices?companyId=&period=&direction=&q=&skip=` | Fatura listesi (100'erli sayfa) |
| GET | `/api/invoices/overview?period=` | Dönem KDV ön kontrol özeti (mükellef başına) |
| GET | `/api/invoices/kdv?companyId=&period=` | Tek mükellef KDV ön kontrol, oran kırılımı |
| DELETE | `/api/invoices/:id` | Faturayı portaldan sil |
| GET | `/api/payroll/template` | Bordro Excel şablonu |
| POST | `/api/payroll/import?dryRun=` | Bordro dosyası (`file`) + `companyId`, `period`, isteğe bağlı `workplaceId`; varsayılan önizleme |
| GET | `/api/payroll/overview?period=` | Dönem bordroları, e-Bildirge mutabakatı, bordrosu eksik işyerleri |
| GET / DELETE | `/api/payroll/runs/:id` | Bordro detayı (personel satırları) / sil |
| GET | `/api/assistant/status` | Asistan modu, model ve günlük kota |
| GET | `/api/assistant/conversations` | Kullanıcının kendi sohbetleri |
| GET / DELETE | `/api/assistant/conversations/:id` | Sohbet ve mesajları / sohbeti sil |
| PUT | `/api/assistant/consent` | Yönetici: yapay zekâ servisine yurt dışı aktarım onayı `{ accept }` (KVKK md.9) |
| POST | `/api/assistant/ask` | Soru sor; yanıt Server-Sent Events olarak akar (meta → delta → done / error) |
| POST | `/api/import/page` | Eklentinin okuduğu GİB / SGK sayfası: beyanname, e-tebligat ve/veya e-Bildirge tabloları; varsayılan önizleme (`dryRun`). Oturum veya eklenti anahtarı ile |
| GET | `/api/tebligat?status=open&days=&q=` | e-Tebligat listesi; `/summary` dashboard sayıları; `PUT /:id/review` büro içi incelendi işareti |
| GET | `/api/notifications` | Kullanıcının bildirimleri (okunma kullanıcı bazında); `POST /:id/read`, `POST /read-all` |
| GET | `/api/notifications/channels` | WhatsApp kanal durumu (üst bar göstergesi) |
| POST | `/api/notifications/reminders/run` | Hatırlatıcıları şimdi çalıştır (yönetici) |
| GET/PUT | `/api/me/notification-settings` | Telefon, WhatsApp rızası, kategoriler; `POST /test` deneme mesajı |
| GET | `/api/edefter/control?month=2026-06` | e-Defter berat durumu (varsayılan: son günü bu aya denk gelen dönem) |
| PUT | `/api/edefter/companies/:id` | Firmanın e-Defter kullanımı ve yükleme tercihi |
| PUT | `/api/edefter/companies/:id/berats/:period` | Yüklendi işareti, elle son gün (süre uzatımı), not |
| GET | `/api/reports/:tur` | CSV rapor: firmalar, beyanname, edefter, tebligat, sgk-rapor, ise-giris-cikis |
| GET/POST/PUT/DELETE | `/api/petitions/templates` | Dilekçe şablonları (hazırlar + büronun kendi şablonları) |
| POST | `/api/petitions/prepare` | Şablonu firma için hazırla (otomatik alanlar dolu) |
| GET/POST/DELETE | `/api/petitions` | Dilekçe arşivi |
| GET/POST/DELETE | `/api/tokens` | Eklenti anahtarları (sadece `gib:import` yetkili, iptal edilebilir) |

Tüm sorgular giriş yapan kullanıcının bürosuna (`tenantId`) göre filtrelenir.

## SGK Vizite (e-Rapor) entegrasyonu

Kaynak: SGK'nın resmi WS_VİZİTE web servisi (`https://uyg.sgk.gov.tr/Ws_Vizite/services/ViziteGonder`, SOAP 1.1 document/literal). Metot ve alan adları servisin WSDL'inden alındı.

- **Senkron akışı:** `wsLogin` → `raporAramaTarihile` (en fazla 100 rapor) → her rapor veritabanına yazıldıktan sonra `raporOkunduKapat` → `onayliRaporlarTarihile` (son 60 gün). Raporlar okundu olarak kapatılmazsa SGK yeni raporları göstermez; kapatma kayıt başarılı olduktan sonra yapılır.
- **Zamanlama:** BullMQ kuyruğu, her gece 02:00 (İstanbul) tüm işyerleri. Aynı anda 2, dakikada en fazla 20 işyeri. Hata durumunda 3 deneme.
- **Şifreler:** AES-256-GCM ile şifreli (`VaultService`). Her şifre çözme, değişiklik ve SGK'ya yazma işlemi `AuditLog` tablosuna yazılır.
- **Demo modu** (`SGK_MODE=mock`, varsayılan): SGK'ya bağlanmaz, aynı kurallarla sahte rapor üretir. Şifresi `hatali` olan işyeri SGK'nın 105 hatasını taklit eder.
- **Canlı mod** (`SGK_MODE=live`): Henüz gerçek bir işyeri bilgisiyle denenmedi. İlk canlı denemeyi bir pilot işyeriyle ve önce sadece okuma (senkron) ile yapın; onay işlemini sonra deneyin.

## SGK 4A işe giriş / işten çıkış

- **Durum:** Yalnızca okuma. SGK'ya verilmiş bildirgeleri listeler; bildirge göndermez. Bildirge gönderimi yasal bağlayıcılığı olan bir işlem olduğu için canlı servis doğrulandıktan sonra ayrı bir adım olarak eklenecek.
- **Giriş bilgileri:** Vizite'den ayrıdır (e-Bildirge kullanıcı adı + sistem şifresi + işyeri şifresi). İki şifre ayrı ayrı şifrelenir.
- **Senkron:** İlk seferde yılbaşından bugüne; sonrakilerde son senkrondan 7 gün öncesinden itibaren (geriye dönük bildirgeleri yakalamak için). Kayıtlar işyeri + tür + T.C. + tarih ile tekilleştirilir.
- **Canlı istemci henüz yok.** SGK bu servisin metot/alan adlarını herkese açık WSDL ile yayımlamıyor; resmi kılavuz e-SGK'daki 4A sayfasında `4atescilWS_Kullanim_Kilavuzu.doc` olarak duruyor ve test ortamı erişimi işyeri sicilinin `entegretescil@sgk.gov.tr` adresine bildirilmesiyle açılıyor. `SGK_MODE=live` iken 4A senkronu bu durumu açıkça belirten bir hata verir; Vizite canlı çalışmaya devam eder. Kılavuz geldiğinde yalnızca `apps/api/src/sgk/tescil/live-tescil.client.ts` doldurulacak.

## SGK e-Bildirge (aylık prim ve hizmet belgeleri)

- **Kaynak:** Mali müşavirin kendi açtığı e-Bildirge "onaylı bildirgeler" sayfası, Chrome eklentisiyle (`sgk.gov.tr` alan adı). Portal SGK'ya kendisi bağlanmaz, e-Bildirge şifresi istemez.
- **Tanıma:** Sütun başlıklarından (`apps/api/src/sgk/ebildirge/ebildirge-parser.ts`): dönem (veya yıl + ay), belge türü, kanun no, mahiyet (asıl/ek/iptal), sigortalı sayısı, prim günü, PEK, tahakkuk, onay tarihi. Belge türü 2 haneye, kanun no 5 haneye tamamlanır.
- **İşyeri eşleştirme:** Satırdaki sicil no → eklentide elle girilen sicil no → sayfa metninde geçen sicil no (portalda tek bir işyerine uyuyorsa). Eşleşme yoksa hiçbir şey yazılmaz, eklenti sicil no sorar.
- **Tekilleştirme:** işyeri + dönem + belge türü + kanun + mahiyet. Aynı belge tekrar aktarılırsa değişmediyse atlanır, değiştiyse güncellenir.
- **Dashboard:** "Güncel çalışan" = her işyerinin en son dönemindeki asıl belgelerin sigortalı sayısı toplamı.
- **Doğrulanmadı:** SGK sayfasının gerçek sütun başlıkları henüz görülmedi; ilk kullanımda önizlemede tanınmazsa başlık kalıpları güncellenecek.

## e-Beyanname kontrolü

- **Yükümlülükler:** Her firma türüne göre varsayılanla başlar (`declaration-rules.ts` → `DEFAULT_OBLIGATIONS`), firma bazında düzenlenebilir.
- **Beklenen beyannameler ve son günler:** KDV ayın 28'i, MUHSGK ve Damga 26'sı (izleyen ay); geçici vergi 1.–3. dönem, çeyreği izleyen ikinci ayın 17'si; yıllık gelir Mart sonu, kurumlar Nisan sonu. Hafta sonuna denk gelen son gün ilk iş gününe kayar. **Resmi tatiller ve GİB süre uzatımları henüz yok** — kesin tarih için GİB vergi takvimi esas alınmalı.
- **Durumlar:** Verildi, Geç verildi, Bekliyor (son gün gelmedi), Gecikti (son gün geçti, verilmemiş).
- **Gerçek veri: kullanıcının kendi oturumu.** Müşavir GİB'e kendisi girer, beyanname listesini açar, Chrome eklentisiyle "Bu sayfayı oku" → önizleme → "Aktar". Şifre saklanmaz, eklenti GİB'e istek atmaz. Tablolar sütun başlıklarından tanınır (`table-parser.ts`, birim testli). Elle girilmiş kaydın yerini GİB sayfasından gelen veri alır. Ayrıntı: `apps/extension/README.md`.
- **Demo:** `GIB_MODE=mock` iken "Demo veriyi yenile" sahte beyanname üretir.

## e-Tebligat

- **Kaynak:** Aynı Chrome eklentisi. Kullanıcı GİB'de e-Tebligat listesini açıp "Bu sayfayı oku"ya basar; sunucu tablonun beyanname mi tebligat mı olduğunu başlıklardan anlar (`tebligat-parser.ts`, birim testli). Sayfada VKN sütunu yoksa eklenti mükellefin VKN/TCKN'sini sorar.
- **Tebliğ sayılma:** Ulaşma tarihini izleyen 5. günün sonu (VUK 107/A). Ekranda kalan takvim günüyle gösterilir.
- **Büro içi takip:** "İncelendi" işareti; GİB'deki okunma durumunu değiştirmez. Belge no yoksa içerikten kararlı anahtar türetilir, tekrar aktarım kopya üretmez.

## Bildirimler ve WhatsApp

- **Uygulama içi:** Üst barda zil; okunma kullanıcı bazında. Her bildirimin bir bağlantısı (ör. `/tebligat`, `/beyanname?month=2026-09`) vardır.
- **Otomatik bildirimler:** Yeni e-Rapor (SGK senkronunda), yeni e-tebligat (aktarımda); her sabah 08:30 hatırlatıcıları: son günü 3 gün içinde/bugün olan verilmemiş beyannameler, süresi geçenler, tebliğ sayılma tarihi 2 gün içinde olan incelenmemiş tebligatlar. Her olay `dedupeKey` ile bir kez bildirilir.
- **WhatsApp (Meta WhatsApp Business Cloud API):** Kullanıcı ayarlardan telefonunu girip **açık rıza** verirse (tarihiyle saklanır), seçtiği kategoriler WhatsApp'a da gider. Numara değişirse rıza düşer. Gönderimler BullMQ kuyruğunda, yeniden denemeli, `NotificationDelivery` tablosunda izlenir.
  - `WHATSAPP_MODE=off` (varsayılan örnek) / `mock` (geliştirme: gönderilmiş gibi kaydedilir) / `live`.
  - Canlı için: Meta Business hesabı, WhatsApp Business telefon numarası, kalıcı erişim anahtarı ve onaylı bir şablon gerekir. Şablon (dil `tr`, kategori Utility): `Mükellef Takip bildirimi: {{1}} — {{2}}`. Ayarlar `.env.example`'da.
  - Canlı mod **henüz gerçek Meta hesabıyla denenmedi**.

## Veri güvenliği (KVKK)

Ayrıntı ve gerekçeler: [docs/ai/security-kvkk.md](docs/ai/security-kvkk.md), [docs/adr/](docs/adr/).

- **Büro izolasyonu iki katlı:** sorgular `tenantId` ile filtrelenir ve PostgreSQL **RLS** politikaları diğer büroların satırlarını gizler. Uygulama tablo sahibi olmayan bir rolle bağlanır; her istekte büro bağlamı veritabanı oturumuna yazılır (`platform/database`). Bağlam yoksa hiçbir satır görünmez. E2E testleri bunu gerçek politikalarla sınar.
- **Şifreleme:** kurum şifreleri, TOTP gizli anahtarı ve çalışan kimlik alanları (T.C. kimlik no, ad soyad — e-rapor, işe giriş/çıkış, bordro) AES-256-GCM ile şifreli; eşitlik araması HMAC özetiyle. Anahtar üretimde OpenBao Transit'te, uygulama yalnız açılışta sarılmış veri anahtarını çözdürür. SGK'nın ham satırları saklanmaz. Eski düz kayıtlar worker açılışında şifrelenir.
- **Yanıtlarda maskeleme:** T.C. kimlik no API'den maskeli döner; tam hâli yalnız CSV dışa aktarımında (denetim kaydına yazılır).
- **Denetim kaydı değiştirilemez:** uygulama rolünün UPDATE/DELETE yetkisi yok; büro başına hash zinciri. Kişisel veri okumaları (`pii.read`) da kaydedilir.
- **Dış kanallar:** WhatsApp (Meta, yurt dışı) mesajında mükellef/çalışan adı gitmez; yalnız kategori ve kişisel veri içermeyen kısa metin. Yapay zekâ asistanı (Claude, yurt dışı) büro yöneticisinin onayı olmadan çalışmaz.
- **Loglar:** yapılandırılmış JSON (pino); yetki başlıkları, şifre/anahtar alanları ve mesajlardaki TCKN/VKN/IBAN/telefon/e-posta maskelenir; sorgu dizesi ve gövde yazılmaz.
- **Context'ler arası olaylar** (ör. yeni tebligat → bildirim) transactional outbox ile worker'da işlenir; işlenen olaylar 7 gün sonra silinir.

## Giriş güvenliği ve kullanıcılar

- **Şifre özeti argon2id;** eski bcrypt özetleri ilk başarılı girişte otomatik dönüştürülür.
- **Oturumlar:** giriş erişim anahtarı + tek kullanımlık **yenileme anahtarı** (`Session`, cihaz bazında, varsayılan 7 gün) üretir. Kullanılmış yenileme anahtarı tekrar gelirse (çalınma belirtisi) bütün oturum ailesi kapanır. Çıkış ve uzaktan oturum kapatma erişim anahtarını da anında geçersiz kılar. Erişim anahtarı şimdilik 8 saat (`ACCESS_TOKEN_TTL`); web HttpOnly çerezli oturuma geçince 15 dakikaya inecek.
- **Hız sınırı:** IP başına dakikada 300 istek; giriş/2FA/yenileme dakikada 10 (aşılırsa 15 dk blok); aktarım ve asistan dakikada 20. Sayaçlar Redis'te (birden fazla API kopyasında ortak).
- **Eklenti anahtarları** 90 gün sonra kendiliğinden geçersizleşir (`API_TOKEN_TTL_DAYS`).

- **Oturum doğrulaması her istekte:** JWT'nin yanında kullanıcının aktif olduğu ve oturum sürümü (`sessionVersion`) kontrol edilir. Şifre değişimi, şifre sıfırlama, devre dışı bırakma, rol ve 2FA değişikliği açık oturumları anında kapatır. Rol token'dan değil veritabanından okunur.
- **Hesap kilidi:** 5 hatalı denemede 15 dakika (veritabanında; yeniden başlatmada da geçerli). Kayıtlı olmayan e-postada da aynı maliyette karşılaştırma yapılır, yanıt süresinden e-posta tahmin edilemez.
- **2FA (TOTP, RFC 6238):** Google/Microsoft Authenticator uyumlu; gizli anahtar şifreli; aynı kod iki kez kullanılamaz; 10 tek kullanımlık kurtarma kodu (özetleri saklanır). RFC test değerleriyle doğrulandı.
- **Kullanıcılar:** Yönetici ekler; geçici şifre bir kez gösterilir, kullanıcı ilk girişte değiştirmeden başka sayfaya geçemez. Büroda en az bir aktif yönetici kalır. Şifre kuralı: en az 10 karakter, harf ve rakam.
- **2FA zorunluluğu (büro politikası):** Yönetici `PUT /api/users/policy { require2fa }` ile açar (Kullanıcılar sayfası); açmak için kendi 2FA'sı açık olmalı. Açıkken 2FA'sı olmayan kullanıcıya API sadece `/auth/me`, `/auth/password`, `/auth/2fa/setup`, `/auth/2fa/enable` uçlarını açar, diğerlerinde `403 TWO_FACTOR_REQUIRED` döner ve web `/iki-adim` kurulum ekranına yönlendirir. 2FA kurmamış kullanıcının eklenti anahtarı çalışmaz; kuran kullanıcı 2FA'yı kendisi kapatamaz (telefon değişiminde yönetici sıfırlar). Kural `auth.guard.ts` içinde, testi `auth.guard.spec.ts`.
- **Eklenti anahtarları** sahibi devre dışı bırakılınca çalışmaz.

## Excel'den firma aktarımı

- Şablon (`.xlsx`) veya kendi listeniz (`.xlsx` / `.csv`); başlıklar esnek tanınır (`company-import.ts`, testli).
- Önizleme satır satır: eklenecek / güncellenecek / hatalı (eksik unvan, hatalı numara, dosya içi tekrar, geçersiz e-posta, kota). Satır numaraları dosyadakiyle aynı.
- Portalda olan VKN güncellenir; boş hücre mevcut bilgiyi silmez. Tür boşsa numara uzunluğundan tahmin edilir (uyarıyla). T.C. kimlik no kontrol haneleri doğrulanır (uyarı).
- Güvenlik: sadece yönetici, en fazla 2 MB, sadece .xlsx/.csv, .xlsx açılmadan önce sıkıştırılmamış boyut kontrolü (zip bombası).

## Lisans ve ödeme

- Paketler ve fiyatlar `apps/api/src/billing/plans.ts` (**fiyatlar örnektir**). Tutar sunucuda hesaplanır; istemciden tutar kabul edilmez.
- Lisans bitmemişse süre bitişin üzerine eklenir; ay sonu taşması önlenir. Mevcut firma sayısını karşılamayan paket seçilemez. Aynı ödeme iki kez işlenmez.
- `BILLING_PROVIDER=demo`: gerçek para çekilmez.
- **`BILLING_PROVIDER=iyzico`: iyzico Ödeme Formu** (`billing/iyzico.client.ts`, testli):
  1. Yönetici paketi seçer; sunucu tutarı hesaplar, ödeme kaydı açar, iyzico'dan ödeme sayfası ister (IYZWSv2 / HMAC-SHA256 imzalı). Sepet ve konuşma numarası = ödeme kaydı numarası.
  2. Kullanıcı iyzico'nun sayfasında kartını girer — **kart bilgisi bu sunucuya gelmez**.
  3. iyzico kullanıcıyı `/api/billing/iyzico/callback`'e geri gönderir. Sunucu tarayıcıya güvenmez: token'la iyzico'ya **sorar** ve lisansı ancak şunların hepsi tutarsa uzatır: ödeme `SUCCESS`, dolandırıcılık kontrolü `fraudStatus=1`, sepet/konuşma no eşleşiyor, tahsil edilen tutar ve para birimi beklenenle aynı. `fraudStatus=0` (inceleme) beklemede kalır; "Durumu yenile" ile yeniden sorulur.
  - Taksit kapalı (`enabledInstallments: [1]`): taksitte tahsil edilen tutar değişebilir ve tutar doğrulamasını bozar.
  - Lisans uzatma "yalnızca hâlâ bekliyorsa" koşuluyla yapılır: eşzamanlı geri dönüşler lisansı iki kez uzatamaz (testte 6 eşzamanlı istekle doğrulandı).
  - Kuruş yuvarlaması kayan nokta hatasına karşı ondalık gösterimle yapılır.
  - Ayarlar: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_BASE_URL` (varsayılan sandbox), `API_PUBLIC_URL` (geri dönüş adresi; canlıda https).
  - İmza biçimi, uç noktalar (`checkoutform/initialize/auth/ecom`, `checkoutform/auth/ecom/detail`, `bin/check`) ve başarı kontrolleri docs.iyzico.com ile karşılaştırıldı; gerçek sandbox'a imzalı istek ulaşıyor (sahte anahtarla `1001 api bilgileri bulunamadı` dönüyor).
  - **Gerçek iyzico sandbox'ıyla uçtan uca doğrulandı (13.10.2026):** anahtar kontrolü ve ödeme formu başlatma başarılı, `http://localhost` geri dönüş adresi kabul edildi (geliştirmede tünel gerekmez). Test kartıyla yapılan ödemede iyzico sorgusu `SUCCESS` ve `fraudStatus=1` döndü; ödeme kaydı PAID oldu, iyzico ödeme numarası saklandı, lisans kalan sürenin üzerine 12 ay uzadı, paket ve kota güncellendi, denetim kaydına checkout → paid → settle sırasıyla yazıldı. Reddedilen kart senaryosu henüz gerçek sandbox'ta denenmedi (yerel sahte iyzico testlerinde lisans uzamıyor).
- **Sandbox'a geçiş:**
  1. https://sandbox-merchant.iyzipay.com → kayıt / giriş → Ayarlar → Firma Ayarları'ndan API ve gizli anahtarı alın.
  2. `apps/api/.env`: `BILLING_PROVIDER="iyzico"`, `IYZICO_API_KEY="…"`, `IYZICO_SECRET_KEY="…"` (anahtarları sohbete veya koda yazmayın).
  3. `npm run iyzico:check -w apps/api` → anahtarları imzalı bir BIN sorgusuyla doğrular (ödeme oluşturmaz, anahtarları ekrana yazmaz). `-- --cf` eklenirse sandbox'ta ödeme formu oturumu da açar ve geri dönüş adresinin kabul edildiğini gösterir.
  4. API'yi yeniden başlatın, Lisans ve ödeme sayfasından paket seçin, iyzico sayfasında iyzico'nun yayımladığı **test kartlarından** biriyle ödeyin (docs.iyzico.com → Test Kartları).
  5. Geri dönüş adresi http://localhost kabul edilmezse (iyzico geçerli SSL istiyor olabilir) `API_PUBLIC_URL` için https bir tünel adresi kullanılır.

## e-Defter berat takibi

- Firma bazında e-Defter kullanımı ve yükleme tercihi (aylık / geçici vergi dönemi bazında; GİB'deki tercihle aynı olmalı).
- Son günler (`edefter-rules.ts`, testli): aylık → ilgili ayı izleyen 4. ayın 10'u (gelir vergisi) / 14'ü (kurumlar vergisi); dönemsel (1.–3.) → dönem sonunu izleyen 2. ayın 10'u / 14'ü; hafta sonu → ilk iş günü. Kaynak: GİB e-Defter sitesi duyuruları ve VUK sirkülerleri.
- **Ekim–Aralık dönemi için kural tarih üretmez** (kaynaklar çelişkili); son gün elle girilir. GİB süre uzatımlarında da satırdan elle düzeltilir.
- Günlük hatırlatıcı: son günü 3 gün içinde / bugün olan ve süresi geçen beratlar (kategori: e-Defter).

## Raporlar

- CSV (UTF-8 BOM, `;` ayraç) — Excel'in Türkçe ayarlarıyla doğrudan açılır.
- Formül enjeksiyonuna karşı `=`, `+`, `-`, `@` ile başlayan metin hücreleri etkisizleştirilir (sayılar etkilenmez).
- Her indirme denetim kaydına (`report.export`) yazılır.

## Dilekçeler

- 6 hazır şablon (genel, pişmanlık VUK 371, izaha davet VUK 370, uzlaşma, borcu yoktur, SGK idari para cezası itirazı) + büronun kendi şablonları.
- `{{alan}}` yer tutucuları; firma bilgileri otomatik dolar, diğerleri formda sorulur; doldurulmamış alanlar vurgulanır.
- Metin serbestçe düzenlenebilir, yazdırılır / PDF alınır, arşive kaydedilir. **Şablonlar örnek metindir; göndermeden önce kontrol edilmelidir.**

## Faturalar (e-Fatura / e-Arşiv) ve KDV ön kontrol

- **Kaynak:** Mükellefin e-Fatura entegratörü portalından indirilen **UBL-TR XML** dosyaları veya bunların **ZIP** arşivi. Bu biçim tüm entegratörlerde aynıdır; entegratör seçimine bağlı değildir. Entegratör API'si seçildiğinde aynı `Invoice` modeline ikinci bir kaynak olarak eklenecek.
- **Eşleştirme:** Satıcı VKN'si portaldaki bir mükellefe uyarsa o mükellefin **satışı**, alıcı VKN'si uyarsa **alışı** olarak kaydedilir (iki mükellef arasındaki fatura iki tarafa da yazılır). Aynı ETTN ikinci kez yüklenirse atlanır. Portalda olmayan VKN'ler önizlemede listelenir.
- **Okunanlar** (`apps/api/src/invoices/ubl-parser.ts`): ETTN, fatura no, tarih, senaryo (temel/ticari/e-Arşiv…), tip (satış/iade/tevkifat…), taraflar, matrah, KDV oran kırılımı (vergi kodu 0015), diğer vergiler, KDV tevkifatı, döviz ve kur. Satır detayı saklanmaz.
- **KDV ön kontrol:** Dönem bazında mükellef başına hesaplanan KDV, satış tevkifatı, indirilecek KDV, KDV2 (alıcı sıfatıyla tevkifat) ve fark. Devreden KDV, ithalat, serbest meslek makbuzu, gider pusulası, ÖKC fişleri dahil değildir; **beyanname yerine geçmez**.
- **Güvenlik:** XML varlık genişletme kapalı; ZIP'ler akış olarak, gerçek açılan bayt sayılarak okunur (zip bombasına karşı dosya başına 5 MB, toplam 300 MB); istek başına 20 dosya / 25 MB / 3000 fatura.
- **Silme:** Yanlış yüklenen fatura portaldan silinebilir; entegratördeki fatura etkilenmez.

## Bordro takibi ve e-Bildirge mutabakatı

- **Kaynak:** Bordro programının personel bazlı Excel (.xlsx) veya CSV çıktısı. Programdan bağımsızdır: başlık satırı ilk 15 satırda aranır (üstteki firma/dönem başlıkları ve alttaki TOPLAM satırı atlanır), sütunlar adlarından tanınır (`apps/api/src/payroll/payroll-parser.ts`). Zorunlu: T.C. Kimlik No, Gün, SGK Matrahı. Kümülatif ve istisna sütunları okunmaz. İndirilebilir şablon: `GET /api/payroll/template`.
- **Portal bordro hesaplamaz.** Gelir ve damga vergisi istisnalar nedeniyle programın sonucu olduğu gibi saklanır.
- **Mutabakat:** Bordrodaki personel sayısı, prim günü ve PEK, aynı dönemin e-Bildirge belgeleriyle (asıl + ek − iptal; sayı sadece asıl belgeden) karşılaştırılır; PEK'te 1 TL tolerans. e-Bildirge'si verilmiş ama bordrosu yüklenmemiş işyerleri ayrıca listelenir.
- **Satır kontrolleri** (kanunla sabit oranlar, 1 TL tolerans): SGK işçi payı %14 (5510 md. 81), işsizlik işçi payı %1 (4447 md. 49), en fazla 30 gün, net ≤ brüt. Geçersiz T.C. kimlik no ve aynı kişinin iki kez yer alması satır hatası olarak raporlanır.
- **Kayıt:** Firma + işyeri + dönem başına tek bordro; yeniden yükleme öncekinin yerine geçer (önizlemede uyarılır). Firmanın tek işyeri varsa otomatik seçilir. T.C. kimlik no ekranda maskelenir; denetim kaydına kişi bilgisi yazılmaz.
- **Doğrulanmadı:** Gerçek bir bordro programı çıktısıyla henüz denenmedi; ilk kullanımda tanınmayan sütun olursa kalıplar güncellenecek.

## Uzmana Sor (yapay zekâ asistanı)

- **Kapsam:** Vergi ve SGK mevzuatı hakkında genel sorular. Asistanın portal verilerine (firmalar, beyannameler, SGK kayıtları) erişimi yoktur; sadece kullanıcının yazdığı soru gönderilir.
- **Gizleme:** Soru, yapay zekâ servisine ve veritabanına gitmeden önce `apps/api/src/assistant/redact.ts` ile maskelenir: TCKN, VKN, IBAN, SGK sicil no, cep telefonu, e-posta. Kullanıcıya neyin gizlendiği gösterilir. İsimler otomatik gizlenemez; ekranda yazmamaları hatırlatılır.
- **Sağlayıcı:** `ASSISTANT_MODE` = `anthropic` (Claude API) | `mock` (anahtar yoksa varsayılan; hazır demo yanıtlar) | `off`. Model `ASSISTANT_MODEL` (varsayılan `claude-opus-5-5`; maliyet için `claude-sonnet-5-5`). Anahtar sadece `apps/api/.env` içindeki `ANTHROPIC_API_KEY`'e yazılır.
- **Güncel bilgi:** `ASSISTANT_WEB_SEARCH=on` ile güncel oran/tutar sorularında yalnızca resmi sitelerde (GİB, SGK, Mevzuat, Resmî Gazete, ÇSGB, TÜRMOB) web araması yapılır ve kaynaklar yanıtın altında listelenir. Kapalıyken asistan bilgisinin belirli bir tarihe kadar güncel olduğunu belirtir.
- **Kota:** Büro başına günlük soru sınırı `ASSISTANT_DAILY_LIMIT` (varsayılan 200). Sayım denetim kaydından yapılır; sohbet silmek kotayı geri vermez. Denetim kaydına soru metni yazılmaz.
- **Gizlilik:** Sohbetleri sadece sahibi görür (büro yöneticisi dahil başkası göremez).
- **Doğrulama:** Claude API'si gerçek bir anahtarla henüz denenmedi; istek/akış biçimi yerel sahte sunucuya karşı test edildi (`anthropic-provider.spec.ts`).
- **Canlıya çıkmadan:** Sorular yurt dışındaki bir servise gittiği için KVKK aydınlatma metnine ve kullanıcı sözleşmesine bu aktarım eklenmeli.

## Yol haritası

- [x] Faz 1: iskelet, giriş, büro/kullanıcı, firmalar, dashboard, vergi takvimi, lisans/kota
- [x] Faz 1b: kullanıcı yönetimi, 2FA, hesap kilidi, Excel/CSV firma aktarımı, lisans ve ödeme (demo sağlayıcı)
- [x] Faz 1c: iyzico Ödeme Formu entegrasyonu (sahte iyzico ile uçtan uca test)
- [x] Faz 1-sandbox: gerçek iyzico sandbox'ında başarılı ödeme uçtan uca doğrulandı
- [ ] Faz 1-canlı: iyzico canlı üye işyeri başvurusu, canlı anahtarlar ve https geri dönüş adresi (yayındaki sunucu)
- [x] Faz 2a: SGK Vizite (e-Rapor) + şifreli kasa + gece senkronu + denetim kaydı
- [x] Faz 2b: SGK 4A işe giriş/çıkış — okuma, demo istemci, ekranlar
- [ ] Faz 2b-canlı: 4A canlı istemcisi (SGK kılavuzu ve test erişimi bekleniyor)
- [ ] Faz 2c: Canlı SGK ile pilot işyerinde doğrulama
- [x] Faz 3: beyanname kontrol motoru, yükümlülükler, elle işaretleme, dashboard grafiği (demo GİB kaynağı)
- [x] Faz 3b: GİB sayfasından aktarım — Chrome eklentisi, eklenti anahtarları, başlık tabanlı tablo tanıma
- [ ] Faz 3c: Eklentiyi gerçek GİB e-Beyanname sayfasında doğrulama; resmi tatil/süre uzatımı takvimi
- [x] Faz 4: bildirim merkezi, otomatik hatırlatıcılar, WhatsApp kanalı (demo), e-Tebligat (eklentiyle aktarım)
- [ ] Faz 4-canlı: Meta WhatsApp hesabıyla canlı gönderim; e-Tebligat sayfasının gerçek GİB'de doğrulanması
- [x] Faz 5a: raporlar (CSV), dilekçeler, e-Defter berat takibi
- [x] Faz 5b: e-Bildirge (eklentiyle SGK sayfasından aktarım)
- [x] Faz 6: Uzmana Sor — yapay zekâ asistanı (demo sağlayıcıyla uçtan uca test, kişisel veri maskeleme, günlük kota)
- [ ] Faz 6-canlı: Claude API anahtarıyla deneme; KVKK aydınlatma metnine yurt dışı aktarımın eklenmesi
- [x] Faz 5c: faturalar — UBL-TR XML/ZIP aktarımı, satış/alış eşleştirme, aylık KDV ön kontrol
- [ ] Faz 5c-entegratör: seçilen özel entegratörün API'siyle otomatik fatura çekme
- [x] Faz 5d: bordro — programdan bağımsız Excel/CSV aktarımı, e-Bildirge mutabakatı, satır kontrolleri
- [ ] Faz 5d-canlı: kullanılan bordro programlarının gerçek çıktılarıyla sütun kalıplarının doğrulanması
