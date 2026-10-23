# Güncel durum — 23 Ekim 2026

Kapsam: `mert/eworks/`. İlk entegrasyon korunuyor; ikinci entegrasyon ayrı dizinde paylaşılıyor. Çalışma yerel pilot düzeyindedir; üretim yayını tamamlanmadı.

## Son doğrulanmış sonuç

- Önceki 11 hata, 5 mükellefe ait 10 beyanname kaydındaydı. Bir MUHSGK kaydında normal belge ve SGK hatası birlikte vardı.
- İlk incelemede 9 kaynak PDF yanıtı hatası ve 2 özel depo yükleme hatası ayrıldı. Eski kod asıl taşıma hatasını kaybettiğinden 9 olayın kesin nedeni geriye dönük belirlenemedi. İki depo hatasında oturum bitişinin aşılması güçlü olasılıktı; eski HTTP kodu kaydı yoktu.
- Yalnız bu kayıtlarla yapılan canlı yeniden deneme başarılı: 10/10 liste sorgusu, 10/10 hedef kayıt, 11/11 önceki hata giderildi. 11 beyanname/vergi tahakkuku PDF'i ve 2 SGK PDF'i depodan geri okuma ve içerik özetiyle doğrulandı.
- Eworks'e 10 mevcut beyanname güncellemesi ve 1 SGK kaydı uygulandı; yeni beyanname oluşturulmadı. Portal Supabase kaydını sürüm 58 olarak doğruladı. Sürüm, o andaki özel pilot hesabına aittir; yeni kurulumda aynı sayı beklenmez.
- Öncesindeki PDF indirmeyen canlı karşılaştırmada tarayıcı ve servis aynı 5 satırı verdi; fark yoktu. Bu testin varsayılan kısa tarih aralığı toplu hedefi değiştirmedi.

## Tamamlanmayan genel kapsam

Kullanıcının son toplu hedefi 274 mükellef için 22 Temmuz–31 Ağustos 2026, iki tarih dilimiyle 548 planlı sorguydu. Önceki bölümde 334 sorgu işlenmiş, bunların 327'si belge yönünden tam olarak sınıflanmıştı. Son sınırlı belge düzeltmesinden sonra genel kapsam yeniden hesaplanmadı; bu eski sayılar güncel tamamlanma sayısı diye sunulmamalı.

Kalan toplu aktarım ve izleme otomasyonu beklemededir. Eylül/Ekim için yeni toplu sorgu yapılmaz; önceki kayıtlar silinmez. Geçerli sözleşme bulunmaması, kayıt bulunmaması, kaynağın belgeyi sunmaması ve robot hatası ayrı durumlardır. Bu çalışma tüm mükelleflerin aktarımının bittiği anlamına gelmez.

Canlı iş kimlikleri, hesap kimliği, müşteri listesi ve PDF'ler paylaşım paketinde bulunmaz. Devam için özel ortamın sahibi tarafından kontrollü olarak sağlanmaları gerekir.

## Ana proje ve e-Defter kararı

Ana proje artık yalnız ikinci entegrasyon yöntemidir. İlk sürüm ana proje ağacından `mert/eworks-arsiv/entegrasyon-1-tarayici/` altına içerikleri değişmeden taşındı; tarihsel Git dalı korunur. e-Defter, aynı oturumda doğrulanmış servis yolu yaklaşımıyla bu ana projeye eklenecek; ilk sürüme eklenmeyecek.

Referans görsel yerleşim örneğidir. Yeni e-Defter ekranı Eworks mavi tonları, beyaz kartları ve mevcut filtre/rozet stiliyle hazırlandı: firma türü, yıl, firma ve kaynak durumu filtreleri, 12 aylık belge matrisi, dönem detayı ve CSV dışa aktarımı. YB/KB/Y kutucukları sadece ilgili sahip/firma/yıl/döneme bağlı doğrulanmış belge kaydı varsa mavi; bilinmeyen aylar gri görünür. Görseldeki sayılar kopyalanmaz; kaynağı doğrulanmayan dönem sıklığı veya yazılım adı üretilmez. Eski yerel dosya takip ekranı ayrı düğmeden korunur; onun notları canlı GİB verisi sayılmaz.

Bu aşama ekran ve proje ayrımıdır. Canlı e-Defter endpoint/alan sözleşmesi ve indirilebilir belge akışı henüz doğrulanmadı; GİB'den belge çek düğmesi bu yüzden pasif. Yeni oturumda canlı kaynak gözlemi, hesap/yetki doğrulaması ve ardından servis adaptörü gerekli. Henüz e-Defter belgesi çekildiği veya entegrasyon tamamlandığı söylenemez.
