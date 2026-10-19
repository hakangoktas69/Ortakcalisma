# Supabase bağlantısı

Mevcut eworks-tasarim.html Supabase URL ve publishable key ile yapılandırıldı. Publishable key yönetim anahtarı değildir; SQL oluşturamaz. Secret/service_role anahtarı HTML'ye konulmamalıdır.

## Bir kez yapılacak kurulum

1. Supabase projesinde SQL Editor'ü açın: https://supabase.com/dashboard/project/opzzdzxinhevwvfmnhfo/sql/new
2. supabase-kurulum.sql dosyasının tamamını çalıştırın. eworks_state (kullanıcıya ait iş kayıtları), eworks_events (işlem geçmişi), RLS ve atomik kaydetme fonksiyonları oluşturulur. Kurulum mevcut kullanıcı verilerini silmez. Aynı isimli özel tablolarınız varsa çalıştırmadan önce yapısını inceleyin.
3. Authentication / Users bölümünde bir portal kullanıcısı oluşturun veya mevcut doğrulanmış hesabınızı kullanın. Portal e-posta/şifre ile giriş yapar; GİB hesabınızı/şifrenizi kullanmayın.
4. Baslat.ps1 ile yerel sunucuyu açın ve portala giriş yapın.
5. Firmalarım / GİB Dosyasını Supabase’e Aktar düğmesiyle mevcut 273 sözleşmeyi hesabınıza aktarın. İlk girişte bulut verisi boşsa portal da boş açılır; gerçek kayıtlar otomatik olarak başka kullanıcılara yüklenmez.

## Kalıcılık

Firma kartları, görevler, modül kayıtları, durum değişiklikleri, sorumlu atamaları, e-defter durumları ve yüklenen dosyaların metadata kayıtları tek kullanıcıya ait JSONB durum belgesinde tutulur. Her kayıt güncellemesi aynı transaction içinde işlem geçmişine eklenir. Dosyaların gerçek içerikleri Storage'a yüklenmez; önceki HTML gibi yalnızca metadata saklanır.

GİB Simülasyonu Oluştur düğmesi açıkça simulation olarak etiketli bir beyanname kaydı oluşturur ve veritabanına kaydeder. Gerçek GİB sözleşme dışa aktarımı gib_export olarak işaretlenir. GİB robotunun canlı bağlantısı hâlâ tamamlanmamıştır.

Sabit demo giriş kaldırıldı. Local Storage uygulama veya oturum verisi için kullanılmaz. Supabase oturumu sekme belleğindedir; tarayıcı kapatıldığında yeniden giriş gerekir, veritabanı kayıtları kalır. Eski JSON yedekleri Ayarlar / Yedekten Geri Yükle ile giriş yapan hesaba aktarılır. Mevcut tarayıcı belleğindeki eski kayıtları yenilemeden önce eski sürümün JSON yedeğini indirin.

## Hatalar

Üst durum çubuğunda Supabase'e kaydedildi yazmadan değişiklik kalıcı sayılmaz. Ağ veya yetki hatasında kaydedilmemiş işler sırada tutulur ve hata paneli açılır. Yeniden dene veya kaydedilmemiş JSON yedeğini indir seçeneklerini kullanın. Kuyruk doluyken çıkış engellenir ve sayfadan ayrılırken uyarı verilir.

İki sekme aynı veriyi düzenlerse sürüm çakışması sessizce üzerine yazılmaz. JSON yedeği alın ve güncel veriyi tekrar yükleyin. Tekrar gönderilen aynı işlem ID'si ikinci kayıt/olay üretmez.

## Doğrulama durumu

Anahtarın Auth settings uç noktasına erişimi doğrulandı. Canlı tablo kurulum ve kullanıcıyla yazma/yeniden okuma testi tamamlanmadan bulut bağlantısı tamamlandı sayılmaz. SQL kurulumu ve kullanıcı girişi gerekir. Gerçek mükellefler henüz bu işlem sırasında buluta yüklenmedi.
