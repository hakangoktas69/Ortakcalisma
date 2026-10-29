# Demo ekranları — 28 Ekim 2026

Bu çalışma yalnız yeni proje kopyasındadır. 8765 portundaki eski Eworks, arşiv entegrasyonlar ve hafıza dosyaları değiştirilmez. 29 Ekim 2026 tarihli kullanıcı talebiyle değişiklikler yalnız `mert/demo-ekran-tamamlama` dalına commit ve push kapsamına alınmıştır; `dev` ve `main` dallarına birleştirme yapılmaz. Aşağıdaki eski gönderim notları yazıldıkları aşamayı anlatır.

## Çalışma biçimi

- Normal `demo` kipinde portal içerikleri kurgusal firma/kayıtlarla sunulur. Yalnız `YIGIN_KIPI=demo`, `EWORKS_ORTAM=demo` ve TDD rozetleri kapalıyken etkinleşir. Bilinmeyen veya üretim kipinde etkinleşmez.
- Oturum ve sayfa/işlem izinleri sunucuda korunur. İstemciye izinli demo kataloğu verilir; oturum belirteci veya kurum hesabı gönderilmez.
- İçerik ekranları: arama, firma/dönem/durum filtreleri, detay, yerel ekleme/düzenleme, örnek CSV/PDF ve örnek aktarım canlandırması. e-Defter için aylık YB/KB tablosu; tebligatta yalnız liste detayları vardır, belge açılmaz.
- Değişiklikler ofis/kullanıcı/sayfa ile adlandırılan **sessionStorage** alanında tutulur. Gerçek API'ye kaydetme, kurum çağrısı, ileti, ödeme, davet, izin değişikliği yapılmaz. Gerçek kişi veya hesap bilgisi girilmez. Sekme kapanınca demo değişiklikleri kaybolur.
- Bu bir **sunum prototipidir**. Örneğin kullanıcı daveti gerçek e-posta göndermez, ödeme gerçek para hareketi oluşturmaz, kurum hesabı düzenleme gerçek parola kaydetmez. Bu işlemlerin canlı uygulamaları tamamlandı sayılmaz.
- Geliştirme, debug ve üretim asıl sayfaları kullanır. Asıl kabul testlerinin TDD görünümü demo sunumunu kapatır; mevcut testlerin yerini demo testleri almaz. Canlı doğrulama kaydı ve özellik durumları değiştirilmez.

## Dosyalar ve doğrulama

Sunum: `apps/web/src/shared/demo/`; bağlama: `apps/web/src/app/(panel)/layout.tsx`.

Modele ait birim testleri: `model.test.ts`, `catalog.test.ts`. Tarayıcı testleri asıl kabul testlerinden ayrı `apps/web/demo-e2e/` ve `apps/web/playwright.demo.config.ts` altındadır; 375/768/1366/1920 genişliklerde çalışır. Demo testleri gerçek özellikleri yeşile çevirmek için etiketlenmez.

Yerel doğrulama: `pnpm test:kapsam`, `pnpm --filter @eworks/web typecheck`, `pnpm arch`. Asıl kabul testleri: `node tools/deploy/yigin.mjs e2e`.

Demo kabul testi (demo görünümü açık yığına karşı): `pnpm --filter @eworks/web exec playwright test --config playwright.demo.config.ts`. Test koşucusuna `DEMO_SIFRE` ve gerekirse `DEMO_EPOSTA` ortamı verilmelidir; parola komut satırına, test raporuna veya belgeye yazılmaz. Container içinde `TEST_WEB_URL=http://web:3000` kullanılır.

## Sonraki aşama

Her modülün gerçek iş modeli/bağlamı ayrı ayrı tamamlanır, kabul testleri ve canlı kurum erişimi doğrulanır. Bu sunum katmanı gerçek kuruma bağlanmaz. Yeni bir bağlam, şema, yetki veya dağıtım değişikliği gerekiyorsa ekip mimari incelemesine sunulur.

## Ayrıntılı demo ekranları — 29 Ekim 2026

- 8765 kaynağı yalnız okunarak karşılaştırıldı. Bu dizinde firma düzenleme/kurum bilgi kartları, tür/sorumlu/örnek durum filtreleri, maskeli kimlikler, faaliyet dağılımı ve çoklu seçim eklendi. Yeni kurgusal firma eklenebilir; arşivi olmayan firmaya levha düğmesi etkinleştirilmez.
- Vergi levhası akışı Portal Kısayolları içindedir. Firmalar listesindeki Vergi levhası düğmesi en güncel örnek belgeyi ayrı sekmede açar. Önizleme ekranı PDF eklentisi gerektirmez; filigranlı örnek PDF ayrıca indirilebilir.
- Beyanname/SGK aktarımı firma ve başlangıç–bitiş tarihine göre ay dilimleri planlar. Tamamlanan, belge hatası ve sözleşme erişim engeli ayrı sayılır. Yalnız hatalı belgeler yeniden denenir; aynı belge kimliği çoğaltılmaz. Yeni tarih aralığı mevcut ekran arşivini silmez. Gerçek iş, bulut kaydı veya kurum sorgusu oluşturulmaz.
- Beyanname, tahakkuk, SGK tahakkuk ve hizmet listesi arşivleri firma/dönem/belge türüyle ayrılır. SGK ekranında örnek çalışan sayısı ve işyeri sicili vardır.
- Takvim gün/hafta/ay/yıl/liste, tarih gezinmesi, kaynak/kategori süzgeci ve kişisel örnek hatırlatmayı içerir. Tarihler resmî vergi vadeleri değildir.
- e-Defter ekranında yıl, aylık/üç aylık dönem, firma türü, firma/unvan ve örnek belge durumu filtreleri; ayrı YB/KB/Y kutuları, dönem belge detayları ve CSV bulunur. Kontrol edilmeyen dönem belge yok olarak yorumlanmaz.
- Yeni ayrıntı ekranları React belleğindedir; sayfadan çıkınca/yenileyince başlangıç örneklerine döner. Kalıcı kayıt eklenmedi. Önceki genel demo alanlarının sessionStorage davranışı korunur. Gerçek firma verisi, şifre veya kurum adresi bu canlandırmalara taşınmadı.
- Kapsam: yalnız demo sunumu. Gerçek özellik durumları, yetki şeması, oturum/güvenlik, kurum adaptörleri, veritabanı ve dağıtım yapılandırması değiştirilmedi. Hafıza dosyaları, 8765 uygulaması ve GitHub değiştirilmedi. Bağımsız `/review` ve ekip incelemesi yayın/paylaşım öncesi bekler.
- Doğrulama: `pnpm verify` başarılı, 47 dosyada 263 birim testi. Ayrıntılı demo modelleri için önce kırmızı test, sonra 4 başarılı test görüldü. Son demo kabul turunda 375/768/1366/1920 genişliklerde 32/32 test geçti; 53 yetkili sayfa, ciddi/kritik erişilebilirlik ihlali ve sayfa taşması, firma düzenleme/ekleme, ayrı sekmede belge önizlemesi, örnek PDF, arşiv koruma/tekilleştirme, erişim engeli ayrımı, takvim ve e-Defter dönemleri denetlendi. Gerçek API'ye yazma yapılmadığı sınandı. Telefon ve masaüstü ekran görüntüleri incelendi.
- İlk tarayıcı turlarında PDF eklentisine bağımlı önizleme, Türkçe indirme etiketinin erişilebilir adı ve dar ekran tablo kapsayıcısında taşma yakalandı; uygulama düzeltilerek son tur tamamen yeşile döndü. Asıl uygulamanın 172 kabul testi bu sunum değişikliği için yeniden koşulmadı; önceki tur kaydı aşağıdadır. 8080 sağlık ucu ve 8765 eski portal HTTP 200 ile doğrulandı.

## Doğrulama — 28 Ekim 2026

### Takvimin 8765 düzenine uyarlanması — 29 Ekim 2026

- 8765 üzerinde uygulama işlemi yapılmadı; yalnız takvim kaynak kodu referans olarak okundu. Değişiklikler bu ayrı projenin demo sunumundadır.
- Mini ay takvimi, etkinlik noktaları, renkli kaynak/kategori filtreleri, mükellef ve metin araması, bugün/önceki/sonraki gezinmesi, ay/hafta/gün/yıl/liste görünümleri ve seçili kapsama göre CSV eklendi. Aylık hücrelerde üç kayıttan sonrası “+n daha” ile gün detayında açılır.
- Sağ panelde gün ve etkinlik detayları, kaynak etkinliğinden tek kişisel hatırlatma oluşturma, düzenleme ve Bekliyor/Devam Ediyor/Tamamlandı durumları bulunur. Form: başlık, tarih, isteğe bağlı saat, kategori, 0/1/3/7 gün önce hatırlatma, ilgili mükellef veya Ofis/Genel, sorumlu ve not.
- Gerçek GİB verisi, mükellef kaydı veya resmî vade kopyalanmadı. Kaynaklar kurgusal örneklerdir. Kalıcı kayıt ve gerçek bildirim yapılmaz.
- Önce kırmızı görülen takvim model testlerinden sonra 4 test geçti; tam doğrulama 267 birim testinde başarılı. Genel demo kabul turu dört ekran boyutunda 40/40 geçti. İlk turda yakalanan soluk ay dışı gün yazısı ve gündemdeki alt metin karşıtlığı düzeltildi. Formdaki mükellef seçimi, genel not, kaynak/mükellef filtresi, düzenleme, saat/sorumlu/hatırlatma süresi, durum ve CSV sınandı.
- Son görsel düzeltmede filtre kutularının genel input yüksekliğinden etkilenmesi giderildi. Dört ekran boyutundaki 12 takvim testi tekrar geçti; sağ panelin sabit konumu ve ekranın üstünde açılması doğrulandı. Telefon formu ve masaüstü takvimi ekran görüntüleri incelendi; 8080 sağlık ucu HTTP 200 döndü.
- Bağımsız kod incelemesi ve ekip onayı henüz yapılmadı; GitHub'a yükleme veya dev birleşimi yapılmadı. Hafıza dosyaları değiştirilmedi.

- `pnpm verify`: başarılı. Görsel uyarlamadan sonra 259 birim testi; kapsam: %98,52 satır, %89,46 dal. Tip, mimari, salt okunur hafıza/ajan denetimleri ve belge bağlantıları geçti.
- Asıl kabul testleri: 140 portal + 32 satış portalı testi geçti. Bunlar yerel test hesapları ve sahte kurumla çalıştı; gerçek kurum doğrulaması değildir.
- Son demo kabul turu: 16/16 başarılı. 53 yetkili ekran dört genişlikte tarandı; arama/boş durum, dönem filtresi, yerel ekleme/düzenleme ve yenileme, örnek PDF, gerçek API'ye yazma isteği olmaması ve tebligat belgesinin açılmaması doğrulandı. 375 ve 1366 genişlikte e-Defter ekran görüntüleri görsel olarak incelendi. Yığın sonunda demo/demo/rozet=false olarak bırakıldı; 8080 sağlık ucu ve 8765 eski Eworks HTTP 200 döndü.
- Demo için ofis yöneticisine açık 53 içerik ekranı (toplam katalog 54; kurum hız politikası ayrı sistem yetkisi ister) dört ekran sınıfında denetlenir. Envanter: [demo sayfaları](DEMO-SAYFA-ENVANTERI.md).
- İlk tarayıcı turunda güvenli bağlam dışında `crypto.randomUUID` bulunmadığı için yerel ekleme başarısız oldu. Kimlik üretimi sekmedeki kayıt sayısına bağlı, çakışma denetimli üretimle değiştirildi; önce kırmızı regresyon testi, sonra yeşil görüldü.
- İlk tarama testi ofis yöneticisinin sistem hız politikası sayfasına da erişebileceğini varsayıyordu. Test gerçek rol şablonuna uyarlandı; yetkiler genişletilmedi. Yetkisiz ayrıntı adresi açıkça kullanılamıyor görünümü verir.
- Kod ayrı yerel `mert/demo-ekran-tamamlama` dalındadır. Commit/push/dev birleşimi yapılmadı; hafıza ve canlı doğrulama kayıtları değiştirilmedi. Bağımsız `/review` ve ekip incelemesi henüz yapılmadı.
- Ana sayfa düzeltmesi: uzun doğrudan sayfa listesi yerine Günlük Yönetim, Takvim, Ofis ve Destek, Ödeme kategori kartları geri getirildi. Ana sayfada kendisine giden dönüş düğmesi ve işlevsiz örnek yenileme düğmesi kaldırıldı. Önce başarısız olan gezinme testi düzeltmeden sonra 375/768/1366/1920 genişliklerde geçti; alt sayfa dönüşü ve üst logo da doğrulandı.
- Görsel uyarlama: 8765'teki kaynak yalnız okundu. Ana sayfa eski Eworks gibi ortalanmış başlık ve iki sütunlu lacivert/altın simgeli kartlarla düzenlendi; örnek sayaçlar ana sayfadan kaldırıldı. Kategoriler artık tek tek sayfalar yerine modül kartlarına, çok sayfalı modüller alt bölüm kartlarına gider. Sekmelerde simge, lacivert aktif durum ve altın vurgu kullanıldı. Güncellenen gezinme/sekme testi dört ekran boyutunda geçti; ana sayfa, modüller ve sekme ekranlarının görüntüleri incelendi. Asıl uygulama/üretim katmanı ve hafıza dosyaları değiştirilmedi.

## Beyanname zaman seçimi — 29 Ekim 2026

- 8765'in beyanname zaman kartı yalnız kaynak koddan incelendi. Beyanname görüntüleme ve senkron demo ekranlarına iki kartlı zaman seçimi eklendi; 8765'te değişiklik veya uygulama işlemi yapılmadı.
- Solda Dönem Aralığı / Yükleme Zamanı, yıl kısayolları/diğer yıl, aylar ve seçim temizliği; sağda tüm örnek mükellef kapsamı, yükleme başlangıç/bitişi, Son 7 Gün ve demo çekim kontrolleri vardır. Gelecek aylar kapalıdır; sekmeler ok tuşlarıyla değişir.
- Vergilendirme dönemleri yükleme tarihinden bağımsız seçilir. Örnek belgelerin dönemleri seçili aralığı izler; eksik belgeyi tekrar denemek ilk sorgunun kapsamını korur. Gerçek GİB çağrısı veya kalıcı kayıt eklenmedi.
- Önce kırmızı model testi, ardından üç başarılı model testi görüldü. Tam doğrulama: 49 dosyada 270 birim testi; tip, mimari ve salt okunur hafıza/ajan/belge denetimleri başarılı. Son demo kabul turu 375/768/1366/1920 genişlikte 48/48 başarılı.
- İlk tarayıcı turunda seçili ayın hover renginde karşıtlık hatası bulundu ve yalnız yeni demoda düzeltildi. Telefon ve masaüstü zaman kartları görsel olarak incelendi. Aynı ay seçimi, artık yıl, son yedi gün, dönem/yükleme ayrımı, ters/boş aralık, klavye, arşiv ve gerçek API'ye yazma yapılmaması sınandı.
- GitHub'a gönderim, dev birleşimi ve bağımsız kod incelemesi yapılmadı. Hafıza dosyaları ve 8765 korundu.

## Firmalarım tasarım uyarlaması — 29 Ekim 2026

- 8765'teki kaynak yalnız okundu. Özet sayaçları, e-belge kartları, firma işlem çubuğu, dağılım kartları, arama ve hızlı filtreler 8080 demo görünümüne uyarlandı. Firma listesi yatay sayfa taşması olmadan dar ekranda kart düzenine geçer; Düzenle düğmesi görünür kalır.
- Düzenle, sağdan açılan erişilebilir panelde Temel Bilgiler, Firma ve Sorumlu Bilgileri ile sekiz kurum/bilgi kartını gösterir. Ayrı Firma Kartı satır düğmesi eklenmedi. Vergi levhası örnek önizleme ve dönemli arşiv korundu.
- Özet ve e-belge filtreleri, Türkçe unvan araması, gizli seçimleri koruyan toplu seçim/onay, CSV ve örnek sözleşme önizlemesi React belleğindeki kurgusal verilerle çalışır. Gerçek kurum çağrısı, parola alanı ve kalıcı kayıt eklenmedi. Bölüm gezinme bağlantıları korundu.
- Önce başarısız model testinden sonra dört portföy testi geçti. Proje doğrulaması: 50 dosyada 274 test; tip, mimari, salt okunur ajan/hafıza ve belge denetimleri başarılı. Genel demo kabul turu dört ekran boyutunda 56/56 geçti. Son gezinme düzenlemesi sonrası firma akışları aynı dört boyutta 12/12 tekrar doğrulandı; ciddi/kritik erişilebilirlik veya yatay taşma hatası yok. Telefon ve masaüstü görüntüleri incelendi.
- Yalnız izole inceleme deposunun web Docker servisi yeniden derlenip başlatıldı. 8765, hafıza dosyaları ve ilk entegrasyon değiştirilmedi; commit/push/dev birleşimi yapılmadı. Bağımsız inceleme bekliyor.

## Ortak ekranların tasarım eşleştirmesi — 29 Ekim 2026

- 8765 kaynağı yalnız okunarak ortak ekranlar listesi çıkarıldı. Kullanıcının ek talebi gereği Görevler, Notlar ve 8080'e özgü diğer sayfalar görünüm uyarlamasının dışında bırakıldı; özellik veya rota kaldırılmadı.
- Ortak ekranlarda başlık/boşluk/kontrol ölçüleri, tablo ve dört sayaçlı özetler, sağdan açılan detay/form panelleri ve e-Defter filtre/matris düzeni referansa yaklaştırıldı. Önceki simge renkleri ve demo açıklamaları korundu. Karşılaştırma: DEMO-TASARIM-KARSILASTIRMASI.md.
- Önce başarısız kapsam testi, sonra iki başarılı model testi. Tam doğrulama: 51 dosyada 276 test; tip, mimari ve salt okunur ajan/hafıza/belge denetimleri başarılı. Son demo kabul turu 375/768/1366/1920 genişliklerde 64/64 geçti; ciddi/kritik erişilebilirlik ve sayfa yatay taşma hatası yok. Masaüstü ve telefon liste/panel görselleri incelendi.
- Görevler ve Notlar'ın değişiklik öncesi ve son kabul turundaki sekiz ekran görüntüsü dosya içeriği olarak birebir aynı; sonuç test-results/reference-preserved-comparison.json içinde. Yeni yönetim/firmalar sayfalarının kapsam dışında kaldığı da test edildi.
- Yalnız 8080 demo web servisi yeniden derlendi. 8765, hafıza dosyaları ve ilk entegrasyon değiştirilmedi; commit, push ve dev birleşimi yapılmadı. Bağımsız inceleme henüz yapılmadı.

## Demo eksik işlemlerinin tamamlanması — 29 Ekim 2026

- Ana Eworks 8080 demosuna geri alınabilir firma arşivleme, örnek mükellef onayı, onaya bağlı kurum hesabı kullanım izni ve yalnız kurgusal kaynakları yenileyen takvim işlemi eklendi. Onayı geri alma/arşivleme izni kaldırır; arşiv geri alınır; belgeler ve kişisel takvim notları korunur. Gerçek veri, kurum çağrısı veya kalıcı kayıt eklenmedi.
- Önce kırmızı üç model testi, sonra yeşil. Son pnpm verify: 52 dosyada 279 test ve tip/mimari/salt okunur bağlam-belge kontrolleri başarılı. Dört ekran boyutunda genel demo turu 72/72; ayrıca genel işlemler ve dört eski eksik için 50/50. PDF/CSV indirmeleri Docker tarayıcısında doğrulandı. İzin paneli telefon/masaüstü görüntüleri incelendi.
- Güncel sonuç DEMO-MODU-TEST-RAPORU-2026-10-29.md içindedir. 8765, satış portalı, hafıza dosyaları ve ilk entegrasyon değiştirilmedi; commit/push/dev birleşimi yok. Bağımsız inceleme bekliyor.
