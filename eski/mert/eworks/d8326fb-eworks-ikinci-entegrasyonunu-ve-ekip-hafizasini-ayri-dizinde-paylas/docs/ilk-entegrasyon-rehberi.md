# Eworks entegrasyonları

`../entegrasyon-1-tarayici/`, developer/network incelemesinden önceki 21 Ekim 2026 ilk entegrasyonunun paylaşım kopyasıdır. Portal ve Python robotu bu dizinin altında birlikte tutulur. İkinci servis denemesi bu dala dahil değildir; yerelde ayrı `02-developer-servis-denemesi` klasöründedir.

İlk yöntem; GİB sözleşme/e-Beyanname listelerini tarayıcıdan okuma, beyanname ve vergi tahakkuk PDF'lerini indirme, MUHSGK içindeki SGK tahakkuk/hizmet belgelerini Eworks e-Bildirge ekranına kaydetme ve hizmet listesinden çalışan sayısı çıkarma kodlarını içerir. E-Defter menüsü bulunur; tamamlanmış canlı e-Defter aktarımı olarak değerlendirilmemelidir. Toplu taramanın tüm mükelleflerde tamamlandığı iddia edilmez.

## Kaynak doğrulaması

70 kaynak dosyası 21 Ekim envanterinin SHA-256 değerleriyle birebir doğrulandı. Ardından paylaşım kopyasındaki canlı Supabase URL/publishable key sabitleri şablonlarla değiştirildi. Paket dosya özetleri `entegrasyon-1-tarayici/SOURCE-MANIFEST.json` içindedir. PDF.js 6.4.299 ve lisansı yerel PDF görüntüleyici için dahildir.

Mükellef kayıtları, indirilen PDF'ler, iş klasörleri, oturum/token dosyaları, şifreler ve `.env` yüklenmez. Çalışan yerel portal değiştirilmez.

## Kurulum

Python 3.11+ ve Google Chrome gerekir. Paket kökünde:

```powershell
cd entegrasyon-1-tarayici
python -m pip install -r Eworks-Portal/requirements.txt
```

`YOUR_PROJECT.supabase.co` ve `YOUR_SUPABASE_PUBLISHABLE_KEY` şablonlarını kendi projenize göre yapılandırın. HTML portal ve `cloud_credentials.py` dahil bu sabitleri kullanan dosyaları birlikte güncelleyin. Service-role anahtarını tarayıcıya koymayın. Portal SQL, Vault SQL/Edge Function ve `supabase-beyanname-belgeleri.sql` kurulumlarını kendi projenize uygulayın. Ayrıntılar portal dizinindeki Supabase kurulum belgelerindedir.

Yerel OCR için robot dizininde ayrı ortam gerekir:

```powershell
cd Eworks-Python-Robot
python -m venv .ocr-venv
.\.ocr-venv\Scripts\python.exe -m pip install -r requirements-ocr.txt
cd ..
python Eworks-Portal/yerel-sunucu.py
```

Portalı `http://127.0.0.1:8765/eworks-tasarim.html` adresinden açın. GİB bilgileri Eworks hesabına bağlı Vault alanında yapılandırılır. Bağımsız eski CLI yolunda `.env.example` şablonundan yerel `.env` oluşturabilirsiniz. `Baslat.ps1`, Windows Python 3.13 standart kurulum yolunu kullanır; farklı kurulumlarda doğrudan Python komutunu kullanın.

## Kontroller

Robot dizininde `python -m unittest` sentetik testleri çalıştırır. Chrome testleri kurulu Chrome gerektirir. Test sonuçları canlı GİB erişilebilirliğini garanti etmez. Bu dal tarihsel ilk sürümü koruduğundan arşivdeki mevcut test uyumsuzlukları ayrıca `VALIDATION.md` dosyasında belirtilir.
