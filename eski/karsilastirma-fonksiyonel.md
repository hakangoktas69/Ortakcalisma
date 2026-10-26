# Fonksiyonel karşılaştırma: Mükellef Takip, Eworks 1 ve Eworks 2

> Hazırlanma: 26.10.2026. Aynı web uygulamasının iki geliştiricinin hazırladığı üç sürümü yan yana karşılaştırılır. Görsel ve kullanılabilirlik karşılaştırması: [karsilastirma-gorsel.md](karsilastirma-gorsel.md).

## Karşılaştırılan sürümler

| Kısa ad | Ne | Nerede | Tarih |
|---|---|---|---|
| **Mükellef Takip** | NestJS API + Next.js web + Chrome eklentisi + satış portalı (Hakan) | [hakan/mukellef-takip/](hakan/mukellef-takip/README.md) | 12–25.10.2026 |
| **Eworks 1** | İlk entegrasyon: tek HTML portal + Python/Playwright robotu + Supabase (Mert) | [mert/eworks/entegrasyon-1-tarayici/](mert/eworks/README.md) | 21.10.2026 |
| **Eworks 2** | İkinci entegrasyon: Eworks 1'in üzerine aynı oturumda HTTP taşıma, devam, belge tekrarı, yeni e-Defter ekranı (Mert) | Yalnız `dev` dalında: `mert/eworks/entegrasyon-2-servis/` | 23.10.2026 |

- **Eworks 2 bu dalda yok.** `dev` dalı yeniden yapılanma (D28) öncesi düzende. Mert'in 23.10 çalışmaları (4 commit) `eski/` altına taşınmadı; taşımayı dalın sahibi yapar ([README.md](README.md)).
- **Eworks 1 her iki dalda aynı.** `dev`'de `mert/eworks-arsiv/entegrasyon-1-tarayici/` altına içerik değişmeden taşınmış; buradaki kopyayla birebir aynı.
- **Eworks 1 → 2 farkı:** satır sonu farkları ayıklanınca 46 dosyada ~2.000 satır ekleme, ~230 satır silme.

Her projenin 19.10.2026 tarihli tek başına analizi [hkazaz/](hkazaz/hakan-executive-analiz.md) altındadır. O tarihten sonra üç sürüm de değişti; bu belge güncel kodu esas alır.

## 1. Yöntem ve doğrulama durumu

| Ne yapıldı | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Kaynak kod ve belgeler okundu | Evet | Evet | Evet (`dev`'den geçici klasöre çıkarıldı) |
| Uygulama tarayıcıda açıldı | Docker demo yığını, projenin sahte seed verisiyle | Portal; Supabase yanıtları 12 sentetik firmayla taklit edildi | Eworks 1 ile aynı yöntem ve aynı sentetik veri |
| Gezilen ekranlar | İş kutusu, genel bakış, mükellefler, beyanname, SGK, e-Defter, faturalar | Giriş, ana sayfa, firmalar, e-Beyanname, e-Bildirge, e-Defter, ödeme | Eworks 1 ile aynı |

**Doğrulanamayanlar:**

- Üç sürümün de testleri bu inceleme sırasında koşturulmadı. Sayılar kod taramasından, geçti/kaldı bilgisi projelerin kendi belgelerinden gelir.
- Kurumla (GİB, SGK) konuşan hiçbir akış çalıştırılmadı. Eworks robotu, yerel Python köprüsü ve Chrome eklentisi denenmedi.
- "Canlıda doğrulandı" ifadelerinin tümü projelerin kendi belgelerinden alınmıştır.
- Mükellef Takip demo yığınında satış API'si (`satis-api`) sağlık denetiminden geçmedi; giriş noktası (Caddy) elle başlatıldı. Satış portalı ekranları görülmedi.

## 2. Kısa sonuç

| | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Ürün olgunluğu | Geniş kapsamlı, çalışan iş modülleri; dış sistemler demo modunda | Kurum otomasyonu güçlü; diğer modüllerin çoğu arayüz prototipi | Eworks 1 + daha dayanıklı toplu tarama; prototip sayfalar aynı |
| Kurum verisine erişim | Kullanıcının açtığı GİB/SGK sayfasını eklentiyle okur; SGK Vizite için SOAP istemcisi | Robot GİB'e müşavir hesabıyla girer, menüde tıklayarak listeleri ve PDF'leri alır | Giriş ve sözleşme tarayıcıda; liste ve PDF istekleri aynı GİB oturumunun HTTP istemcisiyle |
| Canlıda kanıt | GİB/SGK'da yok; iyzico sandbox ödemesi uçtan uca doğrulanmış | Sözleşme listesi canlı okunmuş (274 kayıt, 17.10.2026) | Önceki 11 belge hatası canlıda giderilmiş, 13 PDF kaydedilmiş (23.10.2026); tarayıcı ve HTTP yolu 5 satırda aynı sonucu vermiş |
| Çalışma biçimi | Çok kiracılı sunucu uygulaması (Docker, RLS) | Tek kullanıcılı yerel pilot (`127.0.0.1`) | Eworks 1 ile aynı |
| Ölçek (yaklaşık) | API ~10.100, web ~9.300, satış ~4.000 satır; 32 veri modeli, 21 migration | Portal tek HTML (~245 KB), robot ~3.700 satır, SQL ~250 satır | Portal tek HTML (~260 KB), robot ~4.600 satır, SQL ~250 satır |
| Otomatik test (yaklaşık) | ~380 test senaryosu (birim + API e2e + RLS + arayüz) | ~140 Python test fonksiyonu + 2 JS test betiği; projeye göre seçili 48 test geçiyor | ~195 Python test fonksiyonu + 2 JS test betiği; projeye göre seçili 79 test geçiyor |

**Bir cümleyle:** Mükellef Takip "ne izlenecek ve nasıl gösterilecek" sorusunu, Eworks "kurumdan veri nasıl alınacak" sorusunu daha iyi çözmüş. Eworks 2 de Eworks 1'in veri alma yolunu uzun toplu taramaya dayanıklı hâle getirmiş.

Üçünün veri toplama yolu da yeni hedef mimariyle olduğu gibi uyumlu değil (bkz. §7).

## 3. Mimari ve çalışma ortamı

| Konu | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Arka uç | NestJS modüler monolit, 13 bounded context (DDD katmanları) + ayrı işçi (BullMQ, outbox) | Yok. Tarayıcı doğrudan Supabase REST/RPC'ye yazar; yerel Python sunucusu (`yerel-sunucu.py`) robot işlerini başlatır | Eworks 1 ile aynı; yerel sunucuya 2 uç eklendi (bağlantı testi, belge tekrar planı) |
| Ön yüz | Next.js + Tailwind; 17 panel + 4 giriş/şifre sayfası | Tek dosya HTML + gömülü JS; ~40 menü sayfası | Eworks 1 ile aynı kabuk; e-Beyanname, e-Bildirge ve e-Defter ekranları değişti |
| Veri modeli | PostgreSQL, Prisma, 32 tablo; her satırda `tenantId`, RLS ile büro izolasyonu | Kullanıcı başına tek JSON belgesi (`eworks_state.payload`, en çok 5 MB) + işlem günlüğü (`eworks_events`); RLS kullanıcı bazlı | Eworks 1 ile aynı |
| Eşzamanlı yazma | Satır bazlı veritabanı işlemleri | Belge sürümü (`revision`) + tekil işlem kimliği; çakışmada yazmaz, yedek önerir | Eworks 1 ile aynı |
| Kiracılık | Büro → kullanıcılar (yönetici/personel) | Her Supabase hesabı kendi verisini görür; büro içi paylaşım yok | Eworks 1 ile aynı |
| Kurulum | Docker Compose (dev/prod/test/demo), Caddy, OpenBao, yedekleme | Python 3.11+, Chrome, Supabase projesi, SQL + Edge Function, isteğe bağlı OCR | Eworks 1 ile aynı; OCR ortam yolu değişkenle verilebilir, tek başlatma betiği |
| Belge depolama | Yok (PDF indirme kapsamı yok) | Supabase Storage özel bucket; SHA-256 özetli beyanname/tahakkuk/SGK PDF'leri, yerel PDF.js görüntüleyici | Eworks 1 + depo yükleme/geri okuma hataları ayrı sınıflanıyor |
| Yerel iş kayıtları | — | `jobs/` klasörü (git dışı) | Eworks 1 + ara sonuç (checkpoint), devam planı, oturum bütçesi dosyaları |

## 4. Kurum entegrasyonu

| Konu | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| GİB'e kim bağlanır | Kimse; kullanıcı sayfayı açar, eklenti tabloyu okur | Yerel Python/Playwright robotu, ayrı Chrome oturumunda | Aynı robot |
| Sorgunun gönderilmesi | — | Tarayıcıda menü, form, sayfalama ve PDF bağlantısı tıklanır | Giriş ve sözleşme listesi tarayıcıda. Beyanname listesi ve PDF istekleri aynı oturumun HTTP istemcisiyle (`service_transport.py`): izinli alan listesi, tarih aralığı, VKN/TCKN eşleşmesi, beklenmeyen filtre denetimi; otomatik yeniden deneme yok |
| Sonuç denetimi | Tablo başlıklarından tür tanıma; önizleme → aktar | Liste toplamı ile satır sayısı karşılaştırılır; uyuşmazlıkta hiçbir şey yazılmaz | Eworks 1'in denetimleri HTTP yanıtına da uygulanır; servis yanıtı doğrulanamazsa doğrulanmış kısım korunup iş durdurulur |
| Bağlantı testi | — | — | "GİB bağlantısını test et": aynı sorgu tarayıcı ve HTTP yoluyla, sonuçlar karşılaştırılır; PDF indirmez, portala yazmaz |
| Trafik gözlemi | — | — | `network_observer.py`: 3 izinli GİB alan adındaki isteklerin şeması (alan adları, veri türleri); değer, çerez, şifre ve token yazılmaz |
| GİB şifresi | Saklanmaz | Supabase Vault; Edge Function (`gib-account`) ile robota, yalnız GİB giriş sayfasına | Eworks 1 ile aynı |
| CAPTCHA | Gerekmez | Kullanıcı elle girer; OCR modülü var ama portal akışında kapalı | Eworks 1 ile aynı |
| Tetikleme | Eklentide "Bu sayfayı oku"; SGK Vizite gece 02:00 | Yalnız düğmeyle; zamanlanmış iş yok, aynı anda tek iş | Eworks 1 ile aynı |
| Uzun tarama | — | 6.800 sn tek süre sınırı; aşılırsa "tarama eksik kaldı" | GİB oturum süresinden bütçe (`session_guard.py`); süre azalınca yeni istek başlatılmaz, ara sonuç kaydedilir. "Bu parçayı bitir" komutu. Aynı hesap ve kapsamda 24 saat içinde kaldığı yerden devam (`bulk_resume.py`) |
| Hata ayrımı | Eklenti önizlemesinde satır hataları | Genel hata iletisi | Sınıflandırılmış hatalar: oturum bitiyor, kaynak hata verdi, kaynak engelledi (401/403'te durur), depo hatası (`integration_errors.py`) |
| Başarısız belgeyi yeniden deneme | — | Toplu "eksik belgeleri tamamla" | "Önceki belge hatalarını yeniden dene": yalnız önceki işteki hatalı kayıtlar; hesap, iş ve sözleşme kanıtı eşleşmezse çalışmaz (`document_retry.py`) |
| SGK | Vizite SOAP istemcisi (canlıda denenmedi); 4A sahte istemci; e-Bildirge eklentiyle | SGK sistemine bağlanmaz. MUHSGK içindeki SGK tahakkuk + hizmet listesi PDF'leri; hizmet listesinden tekil çalışan sayısı | Eworks 1 ile aynı |
| Hız sınırı | Vizite: aynı anda 2, dakikada en çok 20 işyeri; kendi API'si için Redis hız sınırı | Merkezi kurum hız sınırlayıcısı yok; tek iş sınırı | Merkezi sınırlayıcı yok; HTTP erişim/hız hatasında iş durur |
| Canlı kanıt | GİB/SGK sayfalarında doğrulanmadı | Sözleşme listesi canlı (274 sözleşme) | 5 satırlık tarayıcı/HTTP karşılaştırması; 10 hedef kayıtta 11/11 belge hatası giderildi, 13 PDF. 274 mükellef / 548 sorguluk Temmuz–Ağustos toplu taraması tamamlanmadı (projenin kendi kaydı) |

## 5. Modül modül karşılaştırma

Durum işaretleri:

- **Çalışır:** arka ucu ve iş kuralı olan akış.
- **Demo:** çalışır ama dış sistem sahte.
- **Prototip:** ekran var, kayıtlar yalnız elle girilir ya da boştur.
- **Yok:** karşılığı yok.
- **"= Eworks 1":** Eworks 2'de değişiklik yok.

| Modül | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Giriş | Çalışır: e-posta + şifre, resimli güvenlik kodu, 2FA (TOTP + kurtarma kodları), hesap kilidi, şifremi unuttum (kod sahte gönderilir) | Çalışır: Supabase Auth e-posta + şifre; şifre sıfırlama ve 2FA yok | = Eworks 1 |
| Oturum | Yenileme anahtarı döndürme, cihaz oturumları, uzaktan kapatma | Bellekte; sayfa yenilenince yeniden giriş | = Eworks 1 |
| Kullanıcı yönetimi | Çalışır: yönetici ekler, rol, devre dışı, 2FA zorunluluğu | Prototip | = Eworks 1 |
| Firma listesi | Çalışır: ekle/düzenle/pasif, arama, tür filtresi | Çalışır: ekle/düzenle, arama, tür/sorumlu/durum filtresi, hızlı filtreler, onay durumu, toplu onay | = Eworks 1 |
| Firma toplu aktarım | Çalışır: Excel/CSV önizlemeli aktarım (zip bombası korumalı) | Çalışır: GİB sözleşme listesinden robotla; eski GİB Excel'inden JSON aktarımı | = Eworks 1 |
| Firma kartı | Yükümlülükler, e-Defter tercihi | Zengin kart: iletişim, vergilendirme, e-Fatura/e-İrsaliye/e-Defter durumu, kurum portalı kısayolları, firma bazlı GİB hesabı (Vault) | = Eworks 1 |
| Beyanname kontrolü (verilmesi gereken / verilen) | Çalışır: yükümlülük matrisi, son gün kuralları, verildi/geç/bekliyor/gecikti, elle işaretleme | Prototip | = Eworks 1 |
| Beyanname listesi + PDF | Eklentiyle tablo aktarımı; PDF yok | Çalışır (robot): yükleme tarihi veya dönem aralığıyla tüm mükellefler, beyanname ve tahakkuk PDF'leri, "eksik belgeleri tamamla" | Eworks 1 + HTTP taşıma, kaldığı yerden devam, hatalı belgeleri hedefli yeniden deneme, bağlantı testi |
| Kurum incelemesi | Yok | Çalışır: sözleşme ve hesap kapsamı doğrulanamayan kayıtlar "kontrol bekleyen" listesine düşer | = Eworks 1 (belge tekrar işi, taranmış mükellef kapsamını değiştirmez) |
| e-Tebligat | Çalışır (eklentiyle): tebliğ sayılma tarihi (VUK 107/A), büro içi "incelendi" | Prototip: kapsam uyarı paneli + boş tablo | = Eworks 1 |
| SGK e-Bildirge | Eklentiyle aktarım, sütun başlığı tanıma | Çalışır (robot): MUHSGK içinden SGK tahakkuk + hizmet listesi, işyeri × dönem, çalışan sayısı | = Eworks 1 (varsayılan tarih aralığı 22.07–31.08.2026) |
| SGK e-Rapor (Vizite) | Demo: SOAP istemcisi, gece senkronu, onay (SGK'ya yazar) | Prototip | = Eworks 1 |
| İşe giriş/çıkış | Demo (sahte istemci) | Prototip | = Eworks 1 |
| İş kazası | Yok | Prototip | = Eworks 1 |
| SGK kontrol listesi | Yok | Prototip | = Eworks 1 |
| e-Defter | Çalışır: berat son günleri (aylık/dönemsel, gelir/kurumlar), hatırlatıcı, elle son gün | Ekran var: 3 aylık ve 12 aylık görünüm; dosyanın yalnız adı/boyutu tarayıcıda tutulur | Yeni ekran: firma türü/yıl/firma/durum filtreleri, 12 aylık matriste her ay YB (yevmiye beratı), KB (kebir beratı), Y (yevmiye defteri); yalnız doğrulanmış GİB belgesi mavi. **Canlı e-Defter bağlantısı yok**, "GİB'den belge çek" pasif. Eski dosya ekranı "Yerel dosya takibi" düğmesinde |
| Faturalar | Çalışır: UBL-TR XML/ZIP aktarımı, satış/alış eşleştirme, KDV ön kontrol | Prototip | = Eworks 1 |
| Bordro | Çalışır: Excel/CSV aktarımı, e-Bildirge mutabakatı, satır kontrolleri | Yok | = Eworks 1 |
| Dilekçeler | Çalışır: 6 hazır şablon + büro şablonları, otomatik alan doldurma, arşiv | Prototip | = Eworks 1 |
| Raporlar | Çalışır: 6 CSV raporu, formül enjeksiyonu koruması, denetim kaydı | Prototip; her ekranda genel CSV indirme | = Eworks 1 |
| Ödeme | Çalışır: lisans paketleri, iyzico ödeme formu (sandbox'ta doğrulandı) | Prototip: 7 alt sayfa, mükellef tahsilatı odaklı | = Eworks 1 |
| İş kutusu / görev | Çalışır: kurallardan üretilen iş kutusu, büro geneli erteleme | Çalışır: elle görev, durum, takvim | = Eworks 1 |
| Bildirimler | Çalışır: uygulama içi zil, sabah hatırlatıcıları; WhatsApp demo | Basit: okunmamış kayıt ve süresi gelen görev sayısı | = Eworks 1 |
| Yapay zekâ asistanı | Demo: kişisel veri maskeleme, günlük kota, yönetici onayı | Prototip | = Eworks 1 |
| SSS / Yenilikler | Çalışır: içerik kodla sürümlenir | Prototip | = Eworks 1 |
| Arama | Komut paleti (Ctrl+K): sayfa, işlem, mükellef | Üst çubukta sayfa ve firma arama | = Eworks 1 |
| Satış portalı | Çalışır (ayrı uygulama) | Yok | = Eworks 1 |
| Veri yedeği | Sunucu yedeği (şifreli) | Kullanıcı JSON yedeği indirir/geri yükler | = Eworks 1 |
| Dil | Türkçe | Giriş ekranında Türkçe/İngilizce | = Eworks 1 |

Eworks 1 ve 2'de menüdeki ~40 sayfanın yalnız 5'inin özel ekranı var: ana sayfa, firmalar, takvim, e-Defter, portal kullanımı. e-Beyanname görüntüleme, e-Tebligat ve e-Bildirge genel tabloya ek panel alır. Kalan ~30 sayfa aynı genel "kayıt tablosu" şablonunu kullanır.

## 6. Güvenlik ve KVKK

| Konu | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Kimlik doğrulama | argon2id, 2FA, hesap kilidi, güvenlik kodu, oturum sürümü her istekte | Supabase Auth; ek koruma yok | = Eworks 1 |
| Tarayıcıdaki gizli bilgi | Erişim anahtarı (JWT) `localStorage`'da (`mt_token`); HttpOnly çereze geçiş planlanmış, yapılmamış | Supabase adresi ve publishable anahtarı HTML'de; erişim anahtarı JS belleğinde | = Eworks 1 |
| Kurum şifreleri | AES-256-GCM, anahtar OpenBao'da; API'den dönmez; her çözme denetim kaydında | Supabase Vault → Edge Function → yerel robot; proje yöneticisine karşı uçtan uca şifreleme değil | = Eworks 1 |
| GİB oturum anahtarı | — | Robot belleğinde | Robot belleğinde; yalnız süresini okumak için çözülür (yetki için kullanılmaz). Trafik gözlem dosyasına token ve değer yazılmaz |
| Kişisel veri | Çalışan TCKN ve adları şifreli + HMAC arama; API'de maskeli; loglarda maskeleme | Hizmet listesindeki kişi bilgisi yalnız sayıma dönüşür; robot şifre/CAPTCHA/çerez saklamaz | = Eworks 1 |
| Ekranda kimlik numarası | Mükellef listesinde şahıs firmalarının TCKN'si açık (demo verisinde gözlendi) | Firma listesinde VKN/TCKN açık | = Eworks 1; e-Defter matrisinde de açık |
| Denetim kaydı | Hash zincirli, değiştirilemez | `eworks_events` işlem günlüğü + `sistem_loglari` | = Eworks 1 |
| Yayın | Üretim compose'u, Caddy, sır dosyaları | Yalnız yerel; internete açılmamalı | = Eworks 1 |

## 7. Yeni Eworks yapısıyla ilişki

Yeni yapı (depo kökü) **Eworks 1**'in akışlarını taşıdı ([../docs/ai/durum.md](../docs/ai/durum.md)):

- giriş, firmalar, kurum hesapları,
- GİB sözleşmeleri, e-Beyanname + PDF, MUHSGK/SGK,
- görev ve not.

Eworks 1'in kurum incelemesi kuralı karar D36'ya dönüştü. Mükellef Takip'ten satış portalı deseni ve DDD/test düzeni alındı. **Eworks 2 yeni yapıya alınmadı.**

Üç sürümün veri toplama yolu da hedef mimariyle olduğu gibi uyumlu değil:

| Hedef mimari kuralı | Mükellef Takip | Eworks 1 | Eworks 2 |
|---|---|---|---|
| Kullanıcı tarafında kurulum yok (D2, D3) | Chrome eklentisi gerekir | Yerel Python köprüsü + robot gerekir | = Eworks 1 |
| Tarayıcıda gizli bilgi yok (D5) | JWT `localStorage`'da | Supabase anahtarı ve erişim anahtarı tarayıcıda | = Eworks 1 |
| CAPTCHA sunucuda otomatik (D6) | — | Kullanıcı elle girer | = Eworks 1 |
| Kuruma giden istek merkezi hız sınırlayıcıdan (D14, K-22) | Yok (Vizite'de kendi sınırı) | Yok | Yok; hız hatasında durur |
| Web servis birincil, robot yedek (D19) | SOAP istemcisi resmi Vizite servisi | Yalnız tarayıcı robotu | Tarayıcı robotu + gözlenen GİB isteklerinin HTTP ile gönderilmesi. Bu yol resmi web servis değil; Mert'in notu: "resmî bir GİB API'si olarak tanımlanmamalı". **Hedef mimaride kararı yok** |

### Yeni yapıya taşınmaya değer, henüz taşınmamış işlevler

Taşınırsa testleriyle ve yeni kurallara uyarlanarak taşınmalı (kural 10).

| İşlev | Kaynak | Neden değerli | Dikkat |
|---|---|---|---|
| Kurallardan üretilen iş kutusu ve erteleme | Mükellef Takip | "Bugün ne yapmalıyım?" sorusunun tek cevabı | `workspace` bağlamının okuma modeli olarak |
| Beyanname son gün kuralları ve kontrol matrisi | Mükellef Takip | Yeni yapıda liste var, "verilmesi gereken ama verilmeyen" kontrolü yok | Resmi tatil ve süre uzatımı takvimi hiçbir sürümde yok |
| e-Defter berat son günleri | Mükellef Takip | Kurallar birim testli | Ekim–Aralık dönemi elle |
| e-Defter belge matrisi (YB/KB/Y) | Eworks 2 | Yalnız doğrulanmış belgeyi "var" sayan dürüst gösterim | Canlı e-Defter kaynağı henüz gözlenmedi |
| e-Tebligat tebliğ sayılma hesabı (VUK 107/A) | Mükellef Takip | Basit, yüksek değerli kural | Veri kaynağı yeni yapıda robot olmalı |
| Oturum bütçesi, ara sonuç ve kaldığı yerden devam | Eworks 2 | Gece toplu taramada (D6) uzun işin yarıda kalmasını önler | Yeni yapıdaki iş/adım durumu (`SyncJob`/`SyncStep`) ile birleştirilmeli |
| Sınıflandırılmış kurum hataları, 401/403'te durma | Eworks 2 | Kural 5 (bağlantı hatasında hız düşer) ve fail-closed ile uyumlu | `RatePolicy` ve devre kesiciyle birlikte |
| Hatalı belgeleri hedefli yeniden deneme | Eworks 2 | Tüm taramayı tekrarlamadan eksik belgeyi tamamlar | İstek bütçesine sayılmalı |
| Excel/CSV firma aktarımı, CSV formül enjeksiyonu koruması | Mükellef Takip | Güvenlik kontrolleri hazır | — |
| UBL-TR fatura ve bordro mutabakatı | Mükellef Takip | Kaynaktan bağımsız | Bağlama atanmamış modüller açık konusu ([durum.md](../docs/ai/durum.md) madde 3) |
| 2FA, hesap kilidi, kurtarma kodları | Mükellef Takip | Hedef mimaride MFA `identity-access`'te | GoTrue ile yeniden kurulmalı |

**Eworks 1'den taşınmış, korunması gerekenler:**

- liste toplamı ile satır sayısı karşılaştırması ve uyuşmazlıkta yazmama (fail-closed, kural 7),
- Aracılık ve Sorumluluk sözleşmesi incelemesi (D36),
- PDF içerik özeti ile saklama,
- hizmet listesinden kişi bilgisi çıkarmadan sayım.

## 8. Açık sorular

1. **Eklenti yaklaşımı:** Mükellef Takip'in "kullanıcının açtığı sayfayı okuma" yaklaşımı D2/D3 nedeniyle tamamen mi bırakılıyor, yoksa robotun erişemediği sayfalar için yedek yol mu olacak?
2. **HTTP taşıma:** Eworks 2'nin aynı oturumda HTTP taşıma yolu yeni yapıda kullanılacak mı? Kullanılacaksa web servis / robot ayrımındaki (D19) yeri ve kurum kurallarıyla (D14, K-22) uyumu karar kaydına işlenmeli.
3. **Eworks 2'nin taşınması:** Eworks 2 `eski/mert/` altına ne zaman, kim tarafından taşınacak? Mert'in `dev`'deki ekip hafızası ve günlüğü yeni ekip hafızası düzenine nasıl alınacak?
4. **Vizite istemcisi:** Mükellef Takip'teki SGK Vizite SOAP istemcisi (WSDL'den alınmış metot adları), süren GİB/SGK web servis envanteri işine girdi olarak kullanılacak mı?
5. **Satış API'si:** Mükellef Takip demo yığınında satış API'sinin sağlıksız kalması, satış portalı deseni yeni yapıya alınırken incelenmeli mi?
