# Eworks — paylaşılabilir geliştirme kopyası

19 Ekim 2026 tarihinde GİB robotlu portal kaynaklarından hazırlanmıştır. Tamamlanmış ürün değildir. Bu kopya canlı ortama bağlanacak şekilde yapılandırılmamıştır.

## Klasörler
- Eworks-Portal: kullanıcı girişi, portal, yerel sunucu ve Supabase SQL/Edge Function kaynakları.
- Eworks-Python-Robot: Python/Playwright robotu, yardımcı modüller ve testler.

## Kurulum
Python 3.13 kullanılmıştır. Paket kökünde sanal ortam oluşturup etkinleştirin:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r Eworks-Portal/requirements.txt
python -m playwright install chromium
```

OCR yardımcı modülü ayrıca Tesseract gerektirir; mevcut portal akışında CAPTCHA kullanıcı tarafından tamamlanır.

Kendi Supabase projenizi kurun. `https://YOUR_PROJECT.supabase.co` ve `YOUR_SUPABASE_PUBLISHABLE_KEY` yer tutucularını kendi projenizin adresi ve publishable anahtarıyla değiştirin. Portal HTML ve `cloud_credentials.py` içindeki sabitler ile bağımsız robotun `.env.example` dosyasını inceleyin. Service-role anahtarını HTML veya istemci koduna koymayın. SQL kurulumunu ve Vault/Edge Function dokümanlarını okuyarak uygulayın; SQL dosyalarını topluca çalıştırmayın.

```powershell
cd Eworks-Portal
python yerel-sunucu.py
```

Adres: http://127.0.0.1:8765/eworks-tasarim.html

`Baslat.ps1` özgün makinedeki Python313 kurulum yolunu bekler. Sanal ortam kullanırken yukarıdaki Python komutunu tercih edin.

## Durum ve açık işler
Önceki canlı çalışma kaydında 274 GİB sözleşmesinin okunup Supabase'e kaydedildiği belirtilmiştir. Bu pakette gerçek sözleşmeler veya müşteri verileri bulunmaz; paket üzerinde yeni canlı GİB testi yapılmamıştır.

Firma bazlı Vault SQL ve gib-account Edge Function değişiklikleri **test edilmemiş ve dağıtılmamış taslaktır**. Müşavir hesabı akışıyla aynı tamamlanma seviyesinde değildir. Firma portal kısayolları ve e-Tebligat/e-Fatura/e-İrsaliye belge adaptörleri henüz tamamlanmamıştır. İlk hedef firmanın GİB Portal mı özel entegratör mü kullandığı belirlenmelidir.

Alt klasörlerdeki belgeler tarihsel çalışma notları içerir; güncel durum için bu dosyadaki sınırlamalar esas alınmalıdır. Test dosyaları geliştirme kaynaklarıdır; bazılarının canlı hizmet/ek bağımlılık gereksinimleri vardır.

## Aktarım
Bu klasörün tamamını ortak depodaki `mert/eworks` konumuna kopyalayın. `.gitignore` dosyasını da dahil edin. Henüz commit veya push yapılmamıştır.

## Dışarıda bırakılanlar
.env ve yedekleri, gerçek GİB Excel/JSON kayıtları, ekran görüntüleri, çalışma ve oturum klasörleri, geçmiş yedekler ve üçüncü taraf runtime dosyaları. Canlı Supabase proje adresi/publishable anahtarı paylaşım kopyasında örnek değerlerle değiştirilmiştir. Orijinal dosyalar değiştirilmemiştir.
