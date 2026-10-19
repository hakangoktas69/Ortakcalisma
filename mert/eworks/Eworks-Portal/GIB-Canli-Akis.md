# Canlı GİB sözleşme aktarımı

Güncel uygulama Python + Playwright kullanır. UiPath kullanılmaz. Otomasyon yalnızca Firmalarım > Bilgileri Güncelle ile başlatılır; zamanlanmış veri toplama yoktur.

## Akış

1. Portal kullanıcısı Supabase Auth ile giriş yapar. Yerel köprü, kullanıcı oturumunu ve iş sahibini doğrular.
2. Robot GİB için ayrı, geçici bir Chrome oturumu açar. Kullanıcı adı/şifre gib-account Edge Function üzerinden Supabase Vault'tan alınır ve yalnızca resmî GİB giriş sayfasına doldurulur. Yerel dosyaya yazılmaz.
3. Kullanıcı CAPTCHA'yı tamamlayıp Giriş Yap'a basar.
4. Robot İnternet Vergi Dairesi kartını, yalnızca bu uygulamaya ait yönlendirme uyarısındaki ONAYLA düğmesini, E-Beyanname Yetki Bilgileri ve Geçerli E-Beyanname Sözleşmeleri Listesi menülerini izler. Yönlendirme, aynı oturumdan açılmış önceki İnternet Vergi Dairesi oturumlarını sonlandırabilir.
5. Tümünü Göster denetimi hazır olana kadar tekrar aranır. Tablo satırları, alt bilgideki toplam sayı ve sütun başlıklarıyla doğrulanır. Eksik liste, boş liste, kimlik biçimi hatası veya mükerrer sözleşme kaydedilmez.
6. Doğrulanmış sonuç eworks.gib.contracts.v1 biçiminde yerel köprüden portala döner. Firmalar VKN/TCKN ile eşleştirilir.
7. Portal, mevcut Supabase kullanıcı oturumuyla eworks_commit RPC'sine yazar. Beklenen sürüm, tekil işlem kimliği ve kullanıcı yetkisi kontrol edilir. Supabase kaydı başarılı olmadan başarı gösterilmez.

## Oturum ve hata davranışı

Menü belirsizliğinde robot kullanıcıya durum bildirir ve aynı Chrome'da manuel ilerlemeyi bekler. İşin toplam süresi 15 dakikadır; iptalde veya süre sonunda Chrome kapanır. Başarılı tablo okumasından sonra da geçici Chrome kapanır. Bu süreler dışında pencere kendiliğinden kapanırsa hata ayrıca araştırılmalıdır.

GİB ekranı bilgileri ve sözleşmeler kullanıcı tarafından yetkilendirilmiş Supabase hesabına aktarılır. CAPTCHA ve tarayıcı çerezleri kaydedilmez. GİB giriş bilgileri ayrı Vault kaydında tutulur. Yerel robota service_role anahtarı verilmez.

## 17.10.2026 doğrulaması

Canlı oturumda menü yolu sözleşme listesine kadar geçti; GİB toplamı 274, ilk sayfa 20 kayıt olarak okundu. Yönlendirme onayı eklendi. Geç yüklenen Tümünü Göster denetimi için bekleme düzeltildi. Yeni sürümün CAPTCHA sonrasından Supabase kaydına kadar canlı kabul testi sürüyor; tamamlandığı ayrıca kaydedilecektir.

## Tamamlanan canlı kabul testi

17.10.2026, 21:44 (Europe/Istanbul): Kullanıcı CAPTCHA'yı tamamladıktan sonra robot İnternet Vergi Dairesi kartına otomatik kaydırdı, yönlendirme onayını verdi, yetki bilgileri ve geçerli sözleşmeler menülerini açtı. GİB alt bilgisinden 274 toplamı okundu; Tümünü Göster kontrolü otomatik tıklandı. 274 sözleşme doğrulandı ve portal Supabase eworks_commit kaydını Sürüm 7 olarak onayladı. Arayüzde 274 firma satırı mevcut; kayıt hatası görünmüyor. Ekran kanıtı gib-canli-basarili.png.

Son düzeltmeler: dikeyde ekranın altında kalan gerçek kartlar yatay karusel kopyalarından ayrılıyor; Tümünü Göster, alt bilgide olay dinleyicisiyle çalışan div/span olduğunda da tanınıyor. Bu varyantlarla 5 menü/sayım testi geçti. Önceki tam kontrolde 19 test geçmişti.

Bu kabul yerel bilgisayarda çalışan Python robotu içindir. Herkese açık sunucuda uzaktan CAPTCHA ve tarayıcı sunumu ayrı dağıtım çalışması gerektirir. SGK ve beyanname indirme kapsam dışındadır.
