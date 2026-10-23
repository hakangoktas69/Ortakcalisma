# Eworks — entegrasyonlar ve ekip hafızası

Ekip arkadaşları için başlangıç: **[Ortak hafıza](docs/ai/memory/MEMORY.md)** → [Güncel durum](docs/ai/memory/guncel-durum.md) → [Kurulum](entegrasyon-2-servis/README.md).

| Dizin | Amaç |
|---|---|
| `entegrasyon-1-tarayici/` | 21 Ekim ilk tarayıcı entegrasyonu; tarihsel kaynak korunur |
| `entegrasyon-2-servis/` | Aynı oturumda servis taşıma, sorgu karşılaştırması ve sınırlı belge tekrarını içeren ikinci yöntem |
| `docs/ai/memory/` | Ekibin paylaşabileceği mimari, kararlar ve kaldığımız aşama |
| `docs/gunluk/` | Tarihli çalışma özetleri |

23 Ekim canlı doğrulamasında önceki 11 belge hatasının tamamı giderildi; 11 beyanname/vergi tahakkuku PDF'i ve 2 SGK PDF'i özel pilot ortamına kaydedildi. Kalan genel toplu aktarım beklemededir. Paylaşılan pakette gerçek müşteri verisi, PDF, şifre, oturum dosyası veya canlı Supabase proje sabitleri bulunmaz.

Yeni işlere güncel `dev` dalından `feature/…` açılarak başlanır. Git Flow ayarları ve devam adımları [ekip rehberinde](docs/ai/memory/devam-rehberi.md). Ajanlar önce [CLAUDE.md](CLAUDE.md) dosyasını okumalıdır.

İlk sürümün kaynak envanteri kendi `SOURCE-MANIFEST.json` dosyasında korunur. [İlk sürümün eski kurulum notları](docs/ilk-entegrasyon-rehberi.md) ve [ilk sürüm test sınırlamaları](VALIDATION.md) ayrıca saklanır. İkinci sürümün test sonuçları [kendi doğrulama belgesindedir](entegrasyon-2-servis/VALIDATION.md).

Bu kaynaklar yerel pilot içindir. Üretim yayını ve tamamlanmış e-Defter aktarımı olarak değerlendirilmemelidir.
