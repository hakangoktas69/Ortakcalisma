# İkinci entegrasyon paylaşım doğrulaması — 23 Ekim 2026

Bu sonuçlar gerçek hesap ayarları çıkarılmış paylaşım kopyasına aittir.

## Geçen kontroller

Robot dizininde Python 3.13 ve kurulu Google Chrome ile:

```powershell
python -m unittest test_document_retry test_bulk_resume test_integration_failures test_service_transport test_declaration_service test_network_probe test_network_observer test_declaration_sync test_declaration_documents test_cloud_credentials
```

Sonuç: **79 test çalıştı, OK**. Bazı ortak test yardımcıları ve kalıtılmış testler bu unittest sayısına tekrar dahil olur; 79 bağımsız canlı senaryo olarak yorumlanmaz. Oturum bütçesi, kaynak HTTP hata ayrımı, kayıt/hesap/tarih sınırlaması, devam kapsamı, servis/tarayıcı karşılaştırması, PDF yapı doğrulaması ve özel depo hash geri okuması test edildi. İstekler sentetik fixture/mock veya yerelde karşılanan tarayıcı sayfaları üzerindedir; test komutu canlı GİB sorgusu başlatmaz.

Portal dizininde:

```powershell
node --test test-demo-cleanup.cjs test-institution-review.cjs
```

Sonuç: **2 test dosyası geçti**. Demo temizliğinde gerçek kayıtları koruma ve geri alma; incelemede sahiplik, sözleşme, tarih, kayıt tekrarını önleme, belge sürümleri ve SGK çalışan sayısı kanıtları doğrulandı.

Portalın gömülü JavaScript'i ayrıca `node --check` ile kontrol edilir. Yeni Markdown dosyalarının yerel bağlantıları, manifest dosya özetleri, ilk entegrasyonun değişmediği ve paylaşım dosyalarında özel kayıt/bağlantı bilgisi bulunmadığı paket hazırlanırken denetlenir.

## Sınırlar

Tüm tarihsel testler çalıştırılmadı. Eski pilotta ortam/arayüz varsayımına bağlı başka testler bulunur. OCR bağımlılık ortamı ve canlı Supabase kurulumu bu paylaşım doğrulamasında yeniden kurulmadı. Seçili testlerin geçmesi bütün test keşfinin veya yeni bir makinenin canlı aktarımının sorunsuz olacağını garanti etmez.

Özel pilotta aynı gün ayrıca canlı doğrulama yapıldı: önce 5 satırlık tarayıcı/servis karşılaştırması, sonra yalnız önceki 11 hataya yönelik 10 sorgu ve 13 PDF kaydı başarılıydı. Bu sonuçların özeti [güncel durum](../docs/ai/memory/guncel-durum.md) dosyasında; özel ham kanıtlar ve belgeler Git paketinin dışındadır. Yeni hesap için bu canlı başarı sonucu tekrar üretim kanıtı sayılmaz.
