# Eworks yerel kullanım — Python robotu

Baslat.ps1 ile sunucuyu açın. Portal adresi:
http://127.0.0.1:8765/eworks-tasarim.html
Bilgisayar veya sunucu kapalıyken bu adres çalışmaz.

Supabase için oluşturduğunuz e-posta ve şifreyle Eworks'e girin.
GİB şifrenizi Eworks girişinde kullanmayın. Portal oturumu bellektedir;
sayfa yenilendiğinde yeniden giriş gerekir. Veriler Supabase'den yüklenir.

## İstek üzerine sözleşme güncelleme

1. Firmalarım ekranında Bilgileri Güncelle düğmesine basın.
2. Python'un açtığı ayrı Chrome penceresinde müşavir hesabıyla GİB'e girin.
   Güvenlik kodunu kendiniz tamamlayın. Eski Chrome oturumu devralınmaz.
3. Robot görünen İnternet Vergi Dairesi → E-Beyanname Yetki Bilgileri →
   Geçerli E-Beyanname Sözleşmeleri Listesi menülerini bulmayı dener.
   Menü bulunamazsa listeyi elle açabilirsiniz.
4. Robot Tümünü Göster'e basıp alt bilgideki toplamı tablo satır sayısıyla
   karşılaştırır. Eşleşirse aktarım otomatik devam eder. Toplam alt bilgisi
   bulunamazsa Eworks'e sayıyı yazıp Liste hazır, verileri al'a basın.
5. Doğrulanan sonuç firma kayıtlarıyla birleştirilip mevcut Eworks hesabının
   Supabase kaydına gönderilir. Başarı yanıtından sonra kaydedildi mesajı çıkar.

Kayıt hatasında üstte yeniden deneme ve kaydedilmemiş JSON yedeği düğmeleri
çıkar. Kaydetme tamamlanmadan sekmeyi kapatmayın.
Arka planda düzenli sorgu yoktur. UiPath kullanılmaz. Aynı anda tek iş çalışır.
Şifre, CAPTCHA görseli ve tarayıcı çerezleri robot dosyalarına kaydedilmez.

Canlı GİB tablo yapısı henüz doğrulanmadı. Başlık tanıma, çok sayfalı okuma ve
portal kayıt zinciri sentetik verilerle test edildi. Başlık/sayfa/sayı
uyuşmazlığında sonuç kaydedilmez. Ayrıntılar: ../Eworks-Python-Robot/README.md.

Firma eşleşmesi VKN/TCKN üzerinden yapılır. Kaynaktan kaybolan firma otomatik
silinmez. SGK ve e-belge bilgileri bu robotla sorgulanmaz. Simülasyonlar gerçek
kurum sorgusu değildir. OCR kurulumu hazırdır; canlı CAPTCHA otomatik çözümü
bu portal akışında kullanılmaz.

## Önceki aktarım

15 Ekim 2026 tarihli GİB Excel dışa aktarımından 273 sözleşme / 273 mükellef
aktarılmıştır. Bu, yeni Python robotunun canlı çalıştığı anlamına gelmez.
GİB Dosyasını Supabase’e Aktar düğmesi eski yerel JSON'u okur.
Sözleşmeleri JSON İndir düğmesi hesaptaki sözleşmeleri dışa aktarır.
Downloads klasöründeki orijinal HTML değiştirilmedi. Python geçişi öncesi
portal kopyası Python-Gecis-Yedek klasöründedir. Eski UiPath notları yalnızca
arşivdir; güncel düğme bunları çalıştırmaz.

Bu kurulum yalnızca yerel pilottur. Yerel sunucudaki token/owner denetimleri
internet için kimlik doğrulama sağlamaz; sunucuyu doğrudan internete açmayın.

## Örnek veri temizliği (17.10.2026)
Demo firma/görev üretimi, örnek modül satırları, otomatik örnek e-Defter durumları ve yapay bildirimler kaldırıldı. Kaydı olmayan aylar Kontrol edilmedi görünür. GİB simülasyonu oluşturma düğmesi kaldırıldı.
Giriş sırasında açıkça demo/simülasyon olarak tanınan kayıtlar aktif listelerden ayrılır ve normal eworks_commit akışıyla Supabase'e kaydedilir. Gerçek GİB firmaları ve sözleşmeleri korunur. Ayrılan kayıtlar Ayarlar > Portal Kullanımı > Örnek veri temizliğini geri al ile kurtarılabilir. Bu işlem fiziksel veri imhası değildir.
Canlı doğrulama: 274 firma korundu; 1 örnek kayıt ayrıldı; Supabase sürüm 6 kaydı başarılı.
