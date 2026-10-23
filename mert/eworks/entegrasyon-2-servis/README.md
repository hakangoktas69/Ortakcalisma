# Eworks ikinci entegrasyon — ekip kaynak paketi

Bu dizin aktif ana projedir. İlk sürüm proje dışında `../../eworks-arsiv/entegrasyon-1-tarayici/` içinde korunur. e-Defter yalnız ikinci entegrasyon yöntemiyle geliştirilecektir. Bu dizin aynı GİB oturumunda servis taşıması, karşılaştırma, devam ve hedefli belge tekrarı eklenen ikinci yöntemin paylaşım kopyasıdır. Canlı hesap ayarları ve özel sonuçlar dahil değildir.

Önce [ekip hafızasını](../docs/ai/memory/MEMORY.md) okuyun. Son canlı doğrulama ve sınırlar [güncel durum](../docs/ai/memory/guncel-durum.md) dosyasındadır.

## Yerel kurulum

Windows, Python 3.11+ ve Google Chrome gerekir. Kullanılan pilot Python 3.13 üzerindedir. Bu dizinde:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Eworks-Portal/requirements.txt
```

Supabase projenizi kendiniz yapılandırın. `Eworks-Python-Robot/cloud_credentials.py` ve `Eworks-Portal/eworks-tasarim.html` içindeki `https://YOUR_PROJECT.supabase.co` / `YOUR_SUPABASE_PUBLISHABLE_KEY` şablonlarını kendi proje değerlerinizle değiştirin. `.env.example` eski bağımsız CLI yolu içindir; bu iki portal sabitini otomatik değiştirmez. Service-role anahtarı tarayıcıya konmaz. Bu yerel değişiklikleri ortak depoya göndermeyin.

Portal klasöründeki `supabase-kurulum.sql`, `supabase-gib-vault.sql`, `supabase-firma-gib-vault.sql`, `supabase-beyanname-belgeleri.sql` ve `supabase/functions/gib-account/index.ts` kendi projenizde incelenip kurulmalıdır. `Supabase-GIB-Hesap-Kurulum.md` belge/Edge Function ve Vault kurulumunu açıklar. SQL kurulumunu çalışan projede körlemesine tekrar uygulamayın.

Yerel OCR isteğe bağlı ayrı ortamdır:

```powershell
python -m venv Eworks-Python-Robot/.ocr-venv
.\Eworks-Python-Robot\.ocr-venv\Scripts\python.exe -m pip install -r Eworks-Python-Robot/requirements-ocr.txt
.\.venv\Scripts\python.exe Eworks-Portal/yerel-sunucu.py
```

Portalı `http://127.0.0.1:8765/eworks-tasarim.html` adresinden açın. Alternatif başlatma: `./Baslat.ps1 -Python ./.venv/Scripts/python.exe`. OCR ortamı varsayılan konumdan farklıysa `-OcrPython` veya `EWORKS_OCR_PYTHON` kullanılır. Aynı portta ilk entegrasyon açıksa ikinci sunucuyu başlatmayın.

## İşlem türleri

- **GİB bağlantısını test et:** Kaynağın varsayılan kısa aralığında bir tarayıcı ve bir servis liste sorgusunu karşılaştırır; PDF ve portal yazımı yoktur.
- **Güncel e-Beyannameleri Çek:** Seçilen tarih/firma kapsamında canlı sorgu, belge indirme ve doğrulanmış portal kaydı yapar. Açık aktarım talebi olmadan çalıştırmayın.
- **Önceki belge hatalarını yeniden dene:** Yereldeki aynı hesaba ait eski işin `documentFailures` listesinden kapsam çıkarır. `Eworks-Portal/document-retry-source.example.json` dosyasını yerelde `document-retry-source.json` adıyla kopyalayıp geçerli yerel kaynak iş kimliğini verin. Kaynak `jobs/<kimlik>/request.json` ve `declarations-sync-result.json` kanıtları olmadan çalışmaz. Örnek kimlik gerçek iş değildir.

`.gitignore` özel iş klasörlerini, PDF'leri, `.env` ve makineye özel ayarları dışlar. Geçerli sözleşme, hesap sahipliği ve kaynak/kapsam kontrolleri başarısızsa sonuç aktarılmaz. Yeni hesapta eski canlı pilotun kayıtları kendiliğinden oluşmaz.

## Testler

İlgili paylaşım doğrulaması: [VALIDATION.md](VALIDATION.md). Testler sentetik veri ve yerel tarayıcı örnekleri kullanır. Tüm `unittest` keşfi ayrıca geçmişten kalan pilot/ortam varsayımlı testler içerir; seçili paylaşım kontrolleriyle karıştırmayın. Canlı GİB sorguları otomatik test paketinin parçası değildir.

Kod ve bağımlılık envanteri `SOURCE-MANIFEST.json` içindedir. Dahil edilen PDF.js kendi lisansıyla dağıtılır. Üretim barındırma, merkezi iş kuyruğu ve sürekli çalışma bu yerel pilotta tamamlanmış değildir.
