# Uygulamaları Docker'da çalıştırma

`hakan/` ve `mert/` klasörlerindeki kaynaklar değiştirilmeden, buradaki Docker dosyalarıyla derlenir. İki uygulama birbirinden bağımsızdır, aynı anda da çalışabilir (portlar çakışmaz).

Ön koşul: Docker Desktop açık. Mert'in uygulaması için ayrıca Node.js (`npx`) gerekir.

## Hakan — Mükellef Takip

```powershell
cd hkazaz\docker\hakan
docker compose up -d --build
```

| | |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000/api |
| Yönetici | `demo@mukellef.test` / `Demo1234!` |
| Personel | `personel@mukellef.test` / `Personel2026` |

- PostgreSQL 17, Redis 7, API (NestJS) ve web (Next.js) container'ları.
- Migration'lar her açılışta uygulanır. Demo verisi yalnızca ilk açılışta yüklenir.
- Tüm dış servisler demo modunda: GİB, SGK, WhatsApp, iyzico ve Claude'a bağlanılmaz.
- Web, `next dev` ile çalışır, çünkü `next build` şu an `/beyanname` sayfasında hata veriyor. İlk sayfa açılışları bu yüzden birkaç saniye sürebilir.
- Adres olarak `localhost` kullanın. API'nin CORS ayarı `http://localhost:3000` adresine izin veriyor, `127.0.0.1:3000` çalışmaz.
- Durdurmak için `docker compose down`. Verileri de silmek için `docker compose down -v` (bir sonraki açılışta demo verisi yeniden yüklenir).

## Mert — Eworks

```powershell
cd hkazaz\docker\mert
.\baslat.ps1
```

| | |
|---|---|
| Portal | http://127.0.0.1:8765/eworks-tasarim.html |
| Giriş | `demo@eworks.test` / `Demo1234!eworks` |
| Supabase Studio (veritabanı arayüzü) | http://127.0.0.1:55323 |

`baslat.ps1` şu adımları yapar:
1. `mert/eworks` içindeki SQL dosyalarını (`supabase-kurulum.sql`, `supabase-gib-vault.sql`) ve `gib-account` Edge Function'ını yerel Supabase klasörüne kopyalar.
2. `npx supabase start` ile yerel Supabase'i Docker'da açar: Auth, REST, Vault, Edge Functions ve Studio. İlk çalıştırmada birkaç GB imaj indirilir.
3. Demo portal kullanıcısını oluşturur.
4. Portal container'ını (`yerel-sunucu.py`) derleyip başlatır. Supabase adresi ve anahtarı, HTML'deki yer tutucuların yerine container içinde yazılır.

Sınırlar:
- Supabase portları varsayılan 54321–54329 yerine **55321–55329** olarak ayarlandı. Bu makinede Windows (Hyper-V) 54281–54380 aralığını ayırdığı için varsayılan portlar açılamıyor.
- **GİB robotu Docker'da çalışmaz.** Robot görünür bir Chrome penceresi açıyor ve CAPTCHA'yı kullanıcının girmesi gerekiyor. Bu yüzden "Bilgileri Güncelle" düğmesi "Python robotu hazır değil" mesajı verir. Portal, giriş, veri kaydı ve "GİB Giriş Bilgileri" (Vault'a kayıt) çalışır.
- Yerel Supabase boş başlar, yani gerçek firma ya da sözleşme verisi yoktur.
- Firma bazlı Vault SQL'i (`supabase-firma-gib-vault.sql`) test edilmemiş bir taslak olduğu için kurulmaz.
- Durdurmak için `.\durdur.ps1`.
