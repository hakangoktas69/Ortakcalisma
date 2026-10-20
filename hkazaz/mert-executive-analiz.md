# Eworks — Yönetici Özeti (Executive Analysis)

> Kaynak: `mert/eworks` (commit `bb9aaa4`, 19.10.2026'da depoya eklenen paylaşım kopyası). Bu belge kod tabanı ve klasördeki dokümanlar incelenerek hazırlanmıştır.

## 1. Ürün nedir?

**Eworks ("Akıllı Muhasebe Çalışma Alanı")**, mali müşavirin mükellef portföyünü yönetmesi için tasarlanmış bir web portalı ve buna bağlı bir **GİB robotudur**. İki parçadan oluşur:

1. **Eworks-Portal:** Tek sayfalık bir HTML uygulaması. Kullanıcı girişi, firma listesi ve modül ekranları burada. Veriler Supabase bulut veritabanında tutuluyor.
2. **Eworks-Python-Robot:** Müşavirin bilgisayarında çalışan bir Python/Playwright robotu. GİB'e müşavir hesabıyla girer, **"Geçerli E-Beyanname Sözleşmeleri Listesi"**ni okur ve portaldaki firma listesini günceller.

Temel değer önerisi: Müşavirin GİB'deki tüm mükellef sözleşmelerini **tek tıkla** portala aktarması. Firma listesini elle girme ve Excel'den yükleme ihtiyacı ortadan kalkar.

## 2. Bugün çalışan ve çalışmayan kısımlar

| Alan | Durum |
|---|---|
| Supabase hesabıyla giriş, verinin bulutta saklanması | ✅ Çalışıyor (sürüm kontrollü kayıt) |
| GİB sözleşme listesinin robotla aktarılması | ✅ **Canlı GİB'de doğrulandı** (17.10.2026: 274 sözleşme okundu ve Supabase'e kaydedildi) |
| GİB şifresinin Supabase Vault'ta saklanması | ✅ Kurulum yapıldı · ⏳ Şifrenin doldurulması uçtan uca doğrulanmadı |
| CAPTCHA | Kullanıcı elle giriyor (bilerek). OCR modülü hazır ama devrede değil |
| Firma bazlı GİB hesapları | ❌ Taslak, test edilmedi, kurulmadı |
| e-Beyanname, SGK, e-Defter, Faturalar, Ödeme, Raporlar, Dilekçeler, Kullanıcılar | 🟡 **Arayüz tasarımı var, arka uç bağlantısı yok** (ekranlar boş ya da "kontrol edilmedi" görünüyor) |
| e-Tebligat / e-Fatura / e-İrsaliye belge adaptörleri | ❌ Başlanmadı |
| İnternet üzerinden yayın | ❌ Yalnızca yerel bilgisayarda (127.0.0.1) çalışıyor; internete açılması güvenli değil (dokümanda açıkça yazıyor) |

**Özet:** Eworks, tek bir iş akışını (GİB sözleşme listesinin aktarımı) **gerçek GİB ortamında kanıtlamış** bir pilot. Bu, ekipteki diğer projelerde henüz yapılamamış bir şey. Bunun dışındaki modüller şimdilik tasarım prototipi aşamasında.

## 3. Ölçek göstergeleri

| Gösterge | Değer |
|---|---|
| Portal (tek HTML dosyası) | ~1.070 satır / ~208 KB |
| Python robotu (üretim kodu) | ~1.150 satır (6 modül) |
| Supabase SQL + Edge Function | ~290 satır |
| Otomatik testler | 10 test dosyası, ~54 test/kontrol |
| Menüde tasarlanan ekran | ~40 alt sayfa (çoğu prototip) |

## 4. Güçlü yönler

1. **Gerçek veriyle kanıtlanmış otomasyon.** GİB'deki menü geçişi, yönlendirme onayı, "Tümünü Göster" ve toplam sayı doğrulaması canlı ortamda çalıştı.
2. **Veri bütünlüğünde temkinli tasarım.** Liste eksik, sayı uyuşmuyor ya da tekrar eden kayıt varsa hiçbir şey kaydedilmiyor. Kaybolan firma silinmiyor. Aynı işlem iki kez kaydedilmiyor. İki sekmede yapılan değişiklikler birbirinin üzerine sessizce yazılmıyor.
3. **İnsan kontrolünün korunması.** CAPTCHA'yı kullanıcı giriyor, belirsiz menüye tıklanmıyor, robot yalnızca istek üzerine çalışıyor (zamanlanmış veri toplama yok). Bu, GİB kullanım koşulları açısından riski düşürüyor.
4. **Düşük altyapı maliyeti.** Supabase (yönetilen veritabanı, kimlik doğrulama, Vault) sayesinde sunucu yönetimi gerekmiyor.
5. **Dürüst dokümantasyon.** Neyin doğrulandığı ve neyin doğrulanmadığı tarihleriyle yazılmış.

## 5. Riskler ve açık noktalar

| Risk | Etki | Açıklama / Öneri |
|---|---|---|
| **GİB şifresinin saklanması** | Yüksek (hukuki ve güven) | Şifre Supabase Vault'ta şifreli duruyor, ancak dokümanın kendisi belirtiyor: proje yöneticisine karşı uçtan uca şifreleme değil. Müşterilere açıkça anlatılmalı ve KVKK/sözleşme kapsamına alınmalı. |
| **Robot yalnızca müşavirin bilgisayarında çalışıyor** | Yüksek (ölçeklenme) | Bulutta çalışması için uzaktan tarayıcı ve CAPTCHA'nın kullanıcıya iletilmesi gerekiyor. Bu ayrı ve zor bir mühendislik işi. |
| **GİB arayüzü değişirse robot durur** | Orta | Menü ve tablo tanıma, ekrandaki metinlere bağlı. Bakım ihtiyacı sürekli olacak. |
| **Tek kullanıcılı veri modeli** | Orta | Her hesabın tüm verisi tek bir JSON belgesinde (en fazla 5 MB). Bir büroda birden fazla personelin birlikte çalışması ve büyük portföyler için yeniden tasarım gerekir. |
| **Modüllerin çoğu yalnızca arayüz** | Orta | Demo sırasında "hazır" izlenimi verebilir. Ürün kapsamı anlatılırken dikkat edilmeli. |
| **Gelir modeli yok** | Orta | Lisans/ödeme altyapısı tasarlanmamış. |
| **Kurulum karmaşık** | Orta | Python, Playwright, Chromium, Tesseract, Supabase SQL ve Edge Function kurulumu gerekiyor. Son kullanıcıya kurdurulması zor. |

## 6. Ekipteki diğer çalışmayla ilişki (`hakan/mukellef-takip`)

| Konu | Eworks (mert) | Mükellef Takip (hakan) |
|---|---|---|
| Güçlü olduğu yer | **Canlı GİB otomasyonu kanıtlandı** | Geniş ve çalışan iş modülleri (beyanname kontrolü, SGK, fatura, bordro, ödeme, AI) |
| GİB'e erişim | Robot giriş yapar, gezinir, okur | Kullanıcı kendisi açar, eklenti yalnızca tabloyu okur |
| GİB şifresi | Vault'ta saklanır | Hiç saklanmaz |
| Altyapı | Supabase + yerel Python | Kendi sunucusu (NestJS + PostgreSQL) |
| Canlıda doğrulama | Sözleşme listesi ✅ | GİB/SGK tarafında henüz yok |

İki proje birbirini tamamlıyor. Eworks'ün kanıtlanmış GİB okuma becerisi, Mükellef Takip'in iş modüllerine **ek bir veri kaynağı** olarak bağlanabilir. Ortak ürün kararı verilirken şu sorular netleşmeli:

- Ana platform hangisi olacak?
- GİB şifresi saklanacak mı?
- Robot yerelde mi çalışacak, bulutta mı?

## 7. Önerilen sonraki adımlar (öncelik sırasıyla)

1. **Ürün kararı:** İki projenin nasıl birleştirileceği. Öneri: Eworks robotu, Mükellef Takip'e veri kaynağı olarak bağlansın.
2. **GİB şifresi politikası:** Saklanacaksa KVKK aydınlatma metni, müşteri onayı ve sorumluluk çerçevesi belirlensin.
3. Vault'tan şifre doldurma adımının canlı doğrulamasının tamamlanması.
4. Bir sonraki otomasyon hedefinin seçilmesi (e-Tebligat, beyanname listesi vb.). Firma bazlı hesaplar için ilk hedef firmanın GİB Portal mı özel entegratör mü kullandığı belirlenmeli (README'deki açık soru).
5. Robotun kurulumunun kolaylaştırılması (tek paket/kurulum programı).
6. Çok kullanıcılı büro desteği ve ilişkisel veri modeline geçiş planı.
