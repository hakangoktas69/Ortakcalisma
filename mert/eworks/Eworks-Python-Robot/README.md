# Güncel çalışma durumu — 19 Ekim 2026

Yerel ddddocr motoru ve tek seferlik otomatik Giriş Yap akışı için paket kökündeki `../README.md` dosyasını okuyun. Bu dosyanın aşağıdaki bölümleri tarihsel notlardır; OCR'ın kapalı veya girişin yalnızca elle olduğuna ilişkin eski ifadeler güncel portal akışı için geçerli değildir. Güncel ekleme: captcha_assist.py, local_ocr.py, local_ocr_worker.py ve requirements-ocr.txt. Otomatik giriş/güncelleme uçtan uca canlı testi henüz doğrulanmadı.

# Eworks Python robotu — üç modül

## OCR yardımcı katmanı

gib_automation.py içindeki use_ocr=True yolu OpenCV/numpy ile gri tonlama,
OTSU, uzun yatay/dikey çizgi maskeleri, CLOSE/OPEN, hafif GaussianBlur ve
yeniden ikilileştirme uygular. İlk öneri boş/geçersiz/düşük güvenliyse farklı
kontrastlar ve adaptif eşikleme denenir. Aynı görsel üzerinde en fazla dört
yerel deneme vardır; her Tesseract çağrısı 3 saniyeyle sınırlıdır. Bu döngü
GİB'e ek CAPTCHA veya giriş isteği göndermez.

Tesseract: --psm 6 --oem 3 ve alfanümerik whitelist. Güven değeri doğruluk
garantisi değildir. Çizgi silme harfleri de bozabilir; kullanıcı kontrolü
olmadan giriş gönderilmez. Beş OCR testi ve sentetik AB7X2 motor testi geçti;
gerçek GİB CAPTCHA başarımı ölçülmedi.

Mevcut portal_worker.py giriş yolu CAPTCHA'yı manuel bırakır; bu değişiklik
orada otomatik CAPTCHA okumasını etkinleştirmez. Yardımcı OCR adımını kullanan
bağımsız girişte use_ocr=True ve doğrulanmış görsel/alan seçicileri gerekir.
Uygulama kalıcı CAPTCHA görseli/okunan kod logu üretmez; pytesseract OCR
sırasında kendi temizlediği geçici dosyalar kullanabilir.

## Güncel portal bağlantısı

16 Ekim 2026 canlı doğrulama: Kullanıcı GİB girişi, liste açma ve Tümünü
Göster adımlarını elle tamamladı. Robot HTML tablosundaki 274 sözleşmeyi
doğruladı; Eworks mevcut Supabase oturumuyla kaydetti (sürüm 5, kayıt hatası yok).
Bu denemede Excel kullanılmadı. Menü ve Tümünü Göster adımlarının otomatik
tıklanması canlı ortamda henüz çalışmadı; tamamen otomatik gezinti tamamlanmadı.
Başarılı veri okumasından sonra robot kendi Chrome penceresini kapatır.

Portalın `Bilgileri Güncelle` düğmesi artık `portal_worker.py` dosyasını çağırır.
Bu yol UiPath veya ayrı Supabase giriş istemez. Robot yalnızca listeyi okur;
sonuç portaldaki mevcut Supabase oturumunun `eworks_commit` kayıt kuyruğundan
yazılır. `sistem_loglari` ve `gib_sozlesmeler` SQL dosyaları bu yol için gerekli
değildir; aşağıdaki bağımsız CLI varyantına aittir.

1. Eworks hesabıyla giriş yapın. Bir defaya mahsus `GİB Giriş Bilgileri`
   formundan kullanıcı adı/şifreyi Supabase Vault'a kaydedin. Kurulum:
   `../Eworks-Portal/Supabase-GIB-Hesap-Kurulum.md`.
2. `Bilgileri Güncelle`ye basın. Robot, Supabase'deki hesabı resmî GİB giriş
   alanlarına doldurur. CAPTCHA'yı kendiniz girip Giriş Yap'a basın. Normal
   Chrome'daki önceki oturum devralınmaz. Vault'tan bilgi alma ve gerçek GİB
   alanlarına doldurma için canlı doğrulama henüz tamamlanmadı.
3. Robot görünen menülerde İnternet Vergi Dairesi → E-Beyanname Yetki Bilgileri
   → Geçerli E-Beyanname Sözleşmeleri Listesi yolunu dener. Bulamazsa listeyi
   elle açabilirsiniz. Görünmeyen veya belirsiz hedeflere tıklanmaz.
   Başlık metinleri menü sayılmaz; bağlantı içindeki metinler tek tıklanabilir
   öğeye indirgenir. İki ayrı hedef varsa Chrome açık tutulur ve kullanıcı
   ilgili menüyü elle seçebilir; robot aynı oturumda listeyi aramaya devam eder.
   React kartlarında onclick niteliği veya pointer imleci bulunmadığında,
   İnternet Vergi Dairesi metni Geçiş Yapılabilecek Uygulamalar bölümüyle
   eşleştirilir. Ekran dışındaki karusel kopyaları tıklanmaz.
   Yerel pilotta navigation_adapter.py dosyasındaki geliştirici düzeltmeleri
   sonraki döngüde yeniden yüklenebilir; açık Chrome oturumu korunur.
   navigation-diagnostics.json yalnızca bilinen menü adları, etiket türü,
   imleç/görünürlük ve eşleşme sayıları içerir; URL/hesap/şifre/vergi kaydı içermez.
4. Robot `Tümünü Göster` düğmesine basıp alt bilgide `1 - N listeleniyor.
   Toplam: N` ile gerçek tablo satır sayısını karşılaştırır. Eşleşirse sayı
   otomatik alınır ve aktarım devam eder. Alt bilgi bulunamazsa Eworks'teki
   toplam sayı alanına GİB toplamını yazıp `Liste hazır, verileri al`a basın.
5. Doğru liste başlığı ve dokuz bilinen veri başlığı eşleşirse tablo tanınır.
   Sondaki Görüntüle eylem sütunu desteklenir ve veriye katılmaz.
   Sonraki sayfa düğmesi görünür adından bulunur; belirsizlikte işlem durur.
6. Sonuç sayısı ve kimlikler doğrulandıktan sonra portal mevcut kayıtlara
   birleştirir. `Supabase’e kaydedildi` bildirimi veritabanı yanıtından sonra çıkar.

Menü, tümünü göster ve otomatik tablo tanıma sentetik HTML ile test edildi.
Kullanıcının ekran görüntülerindeki dokuz başlık, Görüntüle sütunu ve alt bilgi
biçimi adaptöre işlendi. Tablo ve 274 kayıt canlı oturumda doğrulandı; otomatik
menü ve Tümünü Göster geçişleri henüz doğrulanmadı. Uyumsuz
ekranda sonuç uygulanmaz; gerekli adaptör o ekrana göre düzeltilmelidir.
Başlangıçta listenin ilk sayfasında olun. Toplamı yanlış girmek eksik çıkarımı
doğru saydırabileceğinden güncel toplamı ekrandan kontrol etmek gereklidir.
Sanal kaydırma ve sayfa numaralı, etiketsiz ok düğmeleri henüz desteklenmiyor.

İş 15 dakika içinde bitmeli.
Sayım veya tablo doğrulama hatasında, bu süre dolana kadar Chrome açık
tutulur ve aynı oturumda kullanıcının ekranı düzeltmesi beklenir. Hata halinde
sonuç Supabase'e gönderilmez. Açıkça İptal seçildiğinde, pencere kullanıcı
tarafından kapatıldığında veya toplam süre dolduğunda oturum sonlanır.

Sonuç mükellef kayıtları sunucunun belleğinde
tutulur; disk durum dosyalarında yalnızca iş kimliği, portal kullanıcı UUID'si,
durum mesajı ve girilen toplam vardır. Tarayıcı profili/şifre/çerez kaydedilmez.
Bu yerel pilot yalnızca 127.0.0.1 üzerinde çalışır. Yerel token ve owner başlığı
internet için kimlik doğrulama değildir; internet yayınına uygun değildir.

Yerel test: `python -m unittest discover -p "test_*.py" -v`

## Bağımsız CLI varyantı

`logger_service.py`, `gib_automation.py`, `main_orchestrator.py` kaydedildi.
Bu üç dosya bağımsız komut satırı varyantıdır. Portal bağlantısı yukarıdaki
portal_worker.py üzerinden çalışır; UiPath kullanılmaz.

Kurulum: `python -m pip install -r requirements.txt`

## Komut satırından başlatma

`python main_orchestrator.py --check` yerel ayarları kontrol eder; ağa bağlanmaz.
`python main_orchestrator.py` doğrulanmış `gib-selectors.json` varsa aktarımı
başlatır. Eksik seçici dosyasıyla işlem güvenli biçimde durur. Örnek JSON bilinçli
olarak boştur; gerçek ekrandan başlık ve seçici yakalanmadan doldurulmamalıdır.

Başlatıcı Supabase e-postası ve şifresini terminalde sorar; şifre görünmez ve
dosyaya kaydedilmez. GİB hesabıyla giriş ve CAPTCHA tarayıcıda kullanıcı tarafından
yapılır. Açılan yeni Chrome oturumu mevcut masaüstü oturumunu devralmaz.
Başlatıcı liste hazır bildirimi ve güncel toplam sayısını kullanıcıdan bekler.
Bu, manuel komut satırı giriş yoludur; portal düğmesi ayrı worker'ı çağırır.

`.env.example` dosyasını `.env` olarak kopyalayın. İçindeki URL ve publishable
key mevcut projeye aittir; kullanıcı tokenını dosyaya eklemeyin.
`sistem_loglari-kurulum.sql` ayrıca Supabase SQL Editor'da çalıştırılmalıdır.
SQL burada hazırlanmıştır; canlı veritabanında çalıştırılmadı.
Sözleşme deposu için `gib_sozlesmeler-kurulum.sql` de ayrıca hazırlanmıştır.
SQL dosyaları yeni tablolar içindir; aynı adlı mevcut tabloların şemasını
otomatik taşımaz. Tekrar çalıştırmada mevcut politika adları hata verebilir;
transaction geri alınır. Canlı tablo şeması henüz kontrol edilmedi.

## Canlı çalışma için kalanlar

- `GibSelectors`: gerçek giriş, başarılı oturum, liste başlığı, tablo ve
  sonraki sayfa seçicileri; dokuz sütunun gerçek başlıkları ve sıra eşlemesi.
- Gerekirse tablo iframe seçicisi ve gerçek popup/menü geçişi için
  `open_contract_list` async callback'i. Doğrulanmamış GİB seçicisi yazılmadı.
- `confirm_captcha` async callback'i güvenlik kodunun insan tarafından
  tarayıcıda girilmesini/düzeltilmesini bekler; True döndüğünde giriş gönderilir.
  OCR isteğe bağlı öneridir, kod/görsel loglanmaz ve diske yazılmaz.
  İnsan kontrolü olmadan CAPTCHA gönderimi veya tekrar denemesi yoktur.
- `expected_count` GİB ekranındaki güncel toplamdan gelmeli. Sayı, başlık,
  kimlik, tekrar veya sayfa hatasında yazma başlamaz. Sanal kaydırmalı/başlıksız
  veya çok seviyeli başlıklı tablolar mevcut adaptöre uygun olmayabilir.
- Bağımsız CLI için Supabase Auth girişi terminalde yapılır. Portal yolunda
  token robota aktarılmaz; kayıt mevcut Eworks oturumundan yapılır.
- `gib_sozlesmeler` yeni ayrı tablodur. Mevcut portal `eworks_state` okur;
  yeni tabloyu portalda gösterecek eşleme henüz yapılmadı.

Başlangıçtaki sabit kullanıcı/şifre ve `MUSTERI_MUSAIVR_ID` yazım hatası
kaldırıldı. Kimlik UUID'si Supabase Auth oturumuyla doğrulanır. Upsert anahtarı
müşavir + mükellef kimliği + sözleşme numarasıdır. Böylece farklı müşavirler
ve aynı mükellefin farklı sözleşmeleri birbirini ezmez. Eksik firmalar silinmez.
İş yalnızca açık çağrı üzerine çalışır; periyodik görev yoktur.

Chrome görünür modda açılır. Yeni bağlam mevcut masaüstü Chrome oturumunu
devralmaz. `existing_page`, Playwright tarafından yönetilen mevcut bir Page
nesnesi ise tekrar giriş yapılmaz ve o tarayıcı robot tarafından kapatılmaz.
Tüm tarayıcı/sayfalama davranışları GİB üzerinde canlı test beklemektedir.

Mevcut Supabase Auth oturumunun istemcisini `configure_logger(client)` ile
bağlayınca `write_log(musavir_id, islem_adi, durum, mesaj)` kullanılabilir.
Alternatif olarak `LoggerService.from_access_token(access_token)` ile işe özel
bir örnek oluşturulur. Token yalnızca bellekte sağlanır. `musavir_id`, GİB sicili
veya VKN değil, oturumdaki Supabase kullanıcısının UUID'sidir. SQL RLS politikası
başka bir kullanıcının UUID'siyle kayıt yazılmasını engeller. Publishable key tek
başına yeterli değildir. Süresi dolan tokenı ana uygulama yenilemelidir.

Çağıran kod yalnızca genel durum metinlerini loglamalıdır. Şifre, CAPTCHA,
çerez, token, ham HTTP yanıtı veya mükellef verisini mesaj olarak vermeyin.
Ek maskeleme belirli desenleri örter; tüm hassas veri biçimlerini garanti etmez.
`False` sonucu logun Supabase'e yazılmadığını gösterir. Kalıcı log kuyruğu yoktur.

Resmî API kaynakları:
- https://supabase.com/docs/reference/python/initializing
- https://supabase.com/docs/reference/python/insert
- https://supabase.com/docs/reference/python/upsert
- https://playwright.dev/python/docs/api/class-locator
- https://playwright.dev/python/docs/api/class-browsertype
