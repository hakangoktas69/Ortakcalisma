# Mali Müşavir Takvimi

Kapsam: `mert/eworks/entegrasyon-2-servis`. Arayüz `Eworks-Portal/eworks-tasarim.html` içinde.

- Aylık 42 hücreli, pazartesi başlangıçlı takvim; mini takvim; günlük, haftalık, yıllık ve liste görünümleri.
- Kaynak/kategori/mükellef/arama filtreleri; gün içindeki ilk üç etkinlik ve “daha” ile gün ayrıntısı. Kaynak takvim kaydı salt okunur; kullanıcı kendine ayrı bir hatırlatma oluşturabilir.
- Kişisel kayıtlar mevcut `data.tasks` üzerinden kullanıcıya özel Supabase atomik kaydına gider. `calendarTaskForm`, kategori/saat/not ve 0/1/3/7 gün önceden hatırlatma bilgisini saklar. Eski görevler silinmez. Aynı resmî kayıttan ikinci hatırlatma istenirse mevcut görev açılır.
- Hatırlatmalar uygulama içidir. Eworks kapalıyken çalışan zamanlayıcı, e-posta, SMS veya tarayıcı push bildirimi kurulmadı.

## Resmî kaynaklar ve güncellik

GİB'in [kamuya açık vergi takvimi](https://gib.gov.tr/vergi-takvimi) sayfasının kullandığı `POST https://gib.gov.tr/api/gibportal/vergiTakvimi/specification/list` yolu gözlenerek kullanıldı. Kimlik doğrulaması veya mükellef bilgisi gönderilmedi. `TAX_CALENDAR_SNAPSHOT` 26.10.2026 kontrol tarihli veridir; canlı otomatik yenileme yoktur.

Servisten gelen 476 kaydın kimlik tekilliği ve toplam sayısı doğrulandı; son tarihi 2026 olan 466 kayıt tarayıcı takvimine alındı. Son tarihi farklı yıl olanlar körlemesine 2026'ya eklenmedi. Sayfalamada son tarih eşitlikleri nedeniyle kayıtlar tekrarlanabildiğinden tekil `id` sırası kullanıldı ve toplam/tekillik doğrulanmadan veri uygulanmadı. Servis alanları `id`, `title`, `description`, `stopdate`, `periodDescription`, `subject` saklanır; kaynak kayıtlar kullanıcı verisi sayılmaz.

GİB tarihleri genel yükümlülüklerdir; tek bir mükellefe özel yükümlülük hesabı yapılmaz. Süre uzatımları ve istisnalar kaynak bağlantısından kontrol edilmelidir. Başka yıl seçildiğinde GİB verisi yüklenmediği açıkça belirtilir. Otomatik yıl tekrarıyla vergi tarihi üretilmez.

Sabit resmî tatiller 2429 sayılı Kanun kapsamındadır. Ramazan/Kurban Bayramı ve arifeleri yalnız 2026 için [Diyanet'in 2026 listesi](https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=153) ile doğrulanmıştır; yarım günler başlıkta belirtilir. [Borsa İstanbul resmî tatil listesi](https://www.borsaistanbul.com/resmi-tatil-gunleri) de kaynak bağlantısı olarak kullanılır. Gelecek yılların dinî tatilleri tahmin edilmez.

## Doğrulama

`Eworks-Python-Robot/test_calendar_ui.py`: tüm dış istekler sahte yanıtlanır. 42 hücre, kaynak/kategori filtreleri, hafta/yıl/liste geçişi, resmî kayıt detayı, hatırlatma ön doldurma, Supabase'e gönderilen hatırlatma alanları, eski görevlerin korunması ve mobil sayfa taşmaması kontrol edilir. Sentetik test canlı kullanıcı verisinin kaydedildiği anlamına gelmez.
