# Satış portalı

Satış ekibinin mali müşavir hesaplarını açıp yönettiği ayrı uygulama. Müşavirler bu portalı görmez. Karar ve güvenlik modeli: [docs/adr/0009-satis-modulu.md](../docs/adr/0009-satis-modulu.md).

```
satis/
  api/   NestJS → /api/satis   (geliştirme: http://localhost:4100)
  web/   Next.js → /satis      (geliştirme: http://localhost:3100/satis, turuncu tema)
```

## Ne yapar

| Ekran | İş |
|---|---|
| Giriş (`/satis/giris`) | E-posta + şifre → iki adımlı doğrulama (zorunlu; ilk girişte QR ile kurulur, kurtarma kodları bir kez gösterilir). Geçici şifreyle girilirse önce şifre değiştirilir. |
| Bürolar (`/satis`) | Tüm müşavir büroları: yetkili, telefon, durum (deneme / aktif / süresi doldu / donduruldu), lisans bitişi, mükellef **sayısı**. Arama ve durum süzgeci. |
| Yeni müşavir (`/satis/yeni`) | Büro adı, müşavirin adı soyadı, telefon, e-posta, paket, deneme süresi (varsayılan 14 gün). Büro + yönetici kullanıcı + deneme lisansı birlikte açılır; geçici şifre **bir kez** gösterilir. Müşavir ilk girişte şifresini değiştirir. İki adımlı doğrulama başta isteğe bağlıdır (kurmayan müşavir girişte resimli güvenlik kodu yazar); zorunluluk büro politikasıyla sonra açılır. |
| Büro (`/satis/buro/:id`) | Bilgileri düzenleme, lisans uzatma (ay ya da gün, paket değişikliği), dondurma / açma, büro kullanıcısının şifresini ya da iki adımlı doğrulamasını sıfırlama, satış işlem geçmişi. Mükellef verisi görünmez. |
| Satış ekibi (`/satis/ekip`) | Ekip arkadaşı ekleme (geçici şifre), kapatma, şifre / 2FA sıfırlama. |

GİB kullanıcı bilgileri formda **yok**: proje kuralı "GİB şifresi saklanmaz" (CLAUDE.md, kural 3); ekip kararı bekleniyor.

## Çalıştırma (geliştirme)

Veritabanı Docker'da açıkken (`npm run db:up`, kök README):

```bash
node infra/docker/scripts/dev-env.mjs satis > satis/api/.env   # yerel satış ayarları (müşavir .env'inden ayrı)
npm run dev:satis-api      # http://localhost:4100/api/satis
npm run dev:satis-web      # http://localhost:3100/satis
```

İlk satış kullanıcısı komut satırından açılır (sonrakiler "Satış ekibi" ekranından):

```bash
npm run satis:kullanici -- ad.soyad@firma.com "Ad Soyad"
```

Geçici şifre ekrana bir kez yazılır. Docker yığınında: `infra/docker/README.md` → "Satış portalı".

## Testler

```bash
npm run test:cov -w satis-api   # saf kurallar (kapsam eşikli)
npm run test:e2e -w satis-api   # gerçek PostgreSQL: giriş akışı, büro işlemleri, veritabanı yetki sınırları
npm run test -w satis-web       # API istemcisi ve biçimlendirme
```

E2E testleri `apps/api` migration'larını ve demo verisini kullanır; `E2E_ADMIN_DATABASE_URL` yoksa Testcontainers ile PostgreSQL açar.

## API uçları (`/api/satis`)

Oturum HttpOnly çerezde; veri değiştiren her istek `X-Satis: 1` başlığı ister.

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/auth/login` | E-posta + şifre → `{ step: 'mfa' \| 'setup', token }` |
| POST | `/auth/login/2fa` | Kod ya da kurtarma kodu → oturum çerezi |
| POST | `/auth/2fa/setup` · `/auth/2fa/enable` | İlk giriş: QR, kodla onay → kurtarma kodları + oturum |
| GET | `/auth/me` | Giriş yapan satışçı |
| POST | `/auth/password` · `/auth/logout` | Şifre değiştir (diğer oturumlar düşer) · çıkış |
| GET | `/offices?q=&status=` | Büro listesi |
| POST | `/offices` | Yeni müşavir (büro + yönetici + deneme lisansı); `tempPassword` bir kez döner |
| GET/PATCH | `/offices/:id` | Ayrıntı (kullanıcılar, işlem geçmişi) · bilgi güncelleme |
| POST | `/offices/:id/extend` | `{ months: 1\|6\|12 }` ya da `{ days }`, isteğe bağlı `plan` |
| POST | `/offices/:id/suspend` · `/resume` | Dondur / aç |
| POST | `/offices/:id/users/:userId/reset-password` · `/reset-2fa` | Büro kullanıcısı şifre / 2FA sıfırlama |
| GET | `/offices/plans` | Paketler |
| GET/POST/PATCH | `/team`, `/team/:id`, `/team/:id/reset-password`, `/team/:id/reset-2fa` | Satış ekibi |
| GET | `/health` | Sağlık (oturumsuz) |
