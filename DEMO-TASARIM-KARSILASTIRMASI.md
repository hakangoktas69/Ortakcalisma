# 8080 / 8765 tasarım karşılaştırması

29 Ekim 2026. Referans, 8765'in ikinci entegrasyon dizinindeki mevcut HTML/CSS kaynağıdır. Bu kaynak yalnız okunmuştur. Uygulama değişiklikleri izole inceleme deposundaki 8080 demo sunumuyla sınırlıdır.

| Alan | Saptanan fark | 8080'de yapılan uyarlama |
| --- | --- | --- |
| Ortak sayfa yerleşimi | İçerik genişliği, başlık, açıklama ve boşluk ölçüleri farklıydı | 1200 px içerik sınırı, 26 px sayfa başlığı, daha kompakt açıklama ve kontrol ölçüleri |
| Ana sayfa ve ortak modül kartları | Başlık yazıları daha büyüktü, başlık altındaki çizgi referansta yoktu | Ortak kartlarda 18/15 px başlıklar, referansa uygun ortalanmış başlık; önceki renk seçenekleri korundu |
| Ortak kayıt listeleri | Her kayıt büyük bağımsız karttı | Masaüstünde işlem/belge, mükellef, dönem, tarih, durum ve Detay sütunları olan kompakt tablo; dar ekranda etiketli kart satırları |
| Sayaçlar | Üç genel demo sayacı vardı | Toplam, tamamlanan, işlem bekleyen ve dikkat gerektiren dört sayaç ve renkli simgeler |
| Kayıt detayı ve ortak formlar | İçeriğin altında açılıyordu | Sağdan açılan, klavye ve Escape ile kullanılabilen modal panel |
| e-Defter | Kontroller uzun iki sütunlu formdu; sayaçlar küçük etiketlerdi | Toplu filtre araç çubuğu, dört özet kartı, kompakt YB/KB/Y hücreleri ve sabit firma sütunu |
| Firmalarım ve Takvim | Önceki işte referansa uyarlanmıştı | Düzen ve işlevler korundu; ortak kontrol ölçüleriyle tutarlılık sağlandı |

## Korunan ekranlar

Görevler ve Notlar dahil 8080'e özgü ekranlar tasarım kapsamının dışındadır. Örneğin müşavir devri, sözleşme sayfası, gece işleri zamanlaması ve denetim kaydı ortak sayfa tasarım listesinden dışlanmıştır. Bunların rotaları, kartları ve işlevleri kaldırılmamıştır. Kapsam, `referenceDesign.ts` içindeki açık ekran listesiyle belirlenir; yeni bir demo özelliği otomatik olarak bu kapsama girmez.

Görevler ve Notlar için değişiklik öncesi/sonrası toplam sekiz PNG (375/768/1366/1920 genişliklerde ikişer ekran) karşılaştırıldı: dosya içerikleri birebir aynı. Ek modül kartlarının görünür kaldığı da tarayıcı testinde doğrulandı.

Demo etiketi ve kurgusal veri açıklamaları korunur. Kurum bağlantısı, gerçek hesap, gerçek veri veya kalıcı kayıt eklenmemiştir. 8765, ilk entegrasyon, hafıza dosyaları ve GitHub dalları değiştirilmemiştir.

## Doğrulama

51 dosyada 276 birim testi ve dört ekran boyutunda 64 demo kabul testi başarılı. Tip, mimari ve salt okunur belge/ajan/hafıza kontrolleri geçti. Son kabul turunda Görevler/Notlar için sekiz önce/sonra görüntü eşleşmesi tekrar doğrulandı. Bağımsız kod incelemesi henüz yapılmadı. Kullanıcının sonraki talebiyle paylaşım yalnız `mert/demo-ekran-tamamlama` dalından yapılır; `dev` veya `main` birleşimi yoktur.
