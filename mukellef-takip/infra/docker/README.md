# Docker ile çalıştırma ve işletim

Bütün sistem container'larla çalışır. Topoloji geliştirmede ve üretimde aynıdır:

```
İnternet ──443──► caddy ──/api──► api ──┬──► postgres (RLS)        [data ağı, internal]
                    │                   ├──► redis                 [app ağı, internal]
                    └──────────► web    └──► openbao (yalnız üretim)
                                 worker ──► postgres, redis, openbao
                                 migrate (tek seferlik) ──► postgres
                                 backup (yalnız üretim) ──► postgres → şifreli dosya
```

- Yalnız **caddy** host'a port açar. `app` ve `data` ağları `internal`: dışarıya çıkamaz, dışarıdan girilemez.
- Bütün container'lar salt okunur dosya sistemiyle, `no-new-privileges` ve tüm Linux yetenekleri düşürülmüş olarak çalışır. Uygulama süreçleri `node` (root olmayan) kullanıcısıyladır.
- Sırlar ortam değişkeninde değil, **Docker secrets** dosyalarındadır (`secrets/`, git'e girmez). Uygulama `X_FILE` değişkeninden okur.
- Veritabanı rolleri: `mukellef_app` (API/worker, RLS'e tabi, tablo sahibi değil), `mukellef_owner` (migration ve yedek), `postgres` (yalnız yönetim). Ayrıntı: `postgres/init/01-roles.sh`.
- İmaj sürümleri sabittir (`node:24.22.0-slim`, `postgres:17.11-alpine`, `redis:7.4.11-alpine`, `caddy:2.11.7-alpine`, `openbao/openbao:2.7.1`). Güncellemeyi bilinçli yapın; CI Trivy ile tarar.

| Dosya | İçerik |
|---|---|
| `compose.yml` | Temel yığın (her ortam) |
| `compose.dev.yml` | Geliştirme: http://localhost:8080, demo servisler, yerel anahtar, demo verisi |
| `compose.prod.yml` | Üretim: alan adı + TLS, OpenBao, yedek |
| `api.Dockerfile` | API imajı (hedefler: `runtime` → api/worker, `migrate`) |
| `web.Dockerfile` | Next.js standalone |
| `scripts/generate-secrets.mjs` | Eksik sırları üretir (var olanlara dokunmaz) |
| `scripts/openbao-init.mjs` | OpenBao ilk kurulumu |

## Geliştirme

```bash
npm run stack:dev        # sırlar → npm run verify (testler) → kapılı imajlar → yığın → arayüz testleri → http://localhost:8080
npm run verify           # yalnız doğrulama (izole test yığını: compose.test.yml); ayrıntı docs/ai/testing.md
npm run test:ui          # yığın ayaktayken 4 ekranda arayüz testleri
npm run stack:logs
npm run stack:down       # verileri silmek için: docker compose -f infra/docker/compose.yml -f infra/docker/compose.dev.yml down -v
```

Demo giriş: `demo@mukellef.test` / `Demo1234!` (personel: `personel@mukellef.test` / `Personel2026`). Demo verisi yalnız veritabanı boşken yüklenir.

Kodu container dışında, sıcak yeniden yüklemeyle çalıştırmak için:

```bash
npm run db:up                         # yalnız postgres + redis (127.0.0.1:5432 / 6379)
node infra/docker/scripts/dev-env.mjs > apps/api/.env   # yerel bağlantı ayarları; mevcut .env'i önce yedekleyin
cd apps/api && DATABASE_URL="$(grep MIGRATE_DATABASE_URL .env | cut -d'"' -f2)" npx prisma migrate deploy && cd ../..
npm run dev:api   # ayrı terminalde: npm run dev:worker, npm run dev:web
```

## Üretim kurulumu (Türkiye'de VM / on-prem)

Ön koşullar: Docker Engine + Compose eklentisi, alan adının DNS kaydı sunucuyu gösteriyor, 80/443 açık, **swap kapalı veya şifreli** (OpenBao anahtarları bellekte tutar), disk şifrelemesi (LUKS) önerilir.

```bash
cd mukellef-takip
cp infra/docker/.env.example infra/docker/.env      # DOMAIN ve modları düzenleyin
node infra/docker/scripts/generate-secrets.mjs       # secrets/ altında rastgele sırlar
chmod 700 infra/docker/secrets
# Gerekli dış servis anahtarlarını ilgili dosyalara yazın (ör. secrets/iyzico_api_key)

DC="docker compose -f infra/docker/compose.yml -f infra/docker/compose.prod.yml --env-file infra/docker/.env"
$DC up -d openbao
node infra/docker/scripts/openbao-init.mjs           # açma anahtarlarını BİR KEZ gösterir; ayrı kişilerde saklayın
$DC up -d --build
```

Kontrol: `https://<alan-adı>/api/health` → `{"status":"ok"}`. API açılırken güvensiz ayar (zayıf sır, demo ödeme, http adres) varsa **açılmaz** ve nedenini log'a yazar (`$DC logs api`).

### OpenBao'yu açma (her yeniden başlatmadan sonra)

Kasa mühürlü açılır; API ve worker anahtarı çözemediği için açılmaz (otomatik yeniden denenir). İki yetkili sırayla:

```bash
$DC exec openbao bao operator unseal     # anahtar ekrana yazılmadan sorulur; iki kez, iki farklı anahtarla
$DC restart api worker
```

Uygulama anahtarı (token) 32 günlük süreli üretilir ve çalışan süreçler günde iki kez yeniler. Sistem 32 günden uzun kapalı kalırsa yeni token: kök anahtar `bao operator generate-root` ile açma anahtarlarından üretilir, `bao token create -policy=mukellef-app -no-default-policy -orphan -period=768h` → `secrets/openbao_token`.

### Anahtar rotasyonu

- **Transit anahtarı:** `bao write -f transit/keys/mukellef/rotate`, ardından yeni sarılmış veri anahtarı `bao write -f -field=ciphertext transit/datakey/wrapped/mukellef bits=256` → `secrets/openbao_wrapped_dek`. Eski veri anahtarı da okunabilsin diye geçiş döneminde iki anahtar halkada tutulmalıdır (yeniden şifreleme işi: yol haritası).
- **JWT_SECRET** değişirse bütün oturumlar düşer. **Veritabanı parolaları:** `ALTER ROLE … PASSWORD`, ardından `secrets/*_url` dosyaları.

### Yedek

`backup` servisi her `BACKUP_INTERVAL_HOURS` saatte bir `pg_dump` alır, AES-256 ile şifreler (`secrets/backup_passphrase`) ve `BACKUP_DIR`'e yazar; `BACKUP_RETENTION_DAYS` günden eskileri siler. Bu dizini kurum dışına (ikinci veri merkezi / şifreli nesne deposu) `rsync`/`rclone` ile senkronlayın — yedekler kişisel veri içerir, yalnız şifreli hâlleri taşınır. Parola dosyasını yedeklerle **aynı yerde** saklamayın.

**Geri yükleme (ayda bir deneyin):**

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass file:infra/docker/secrets/backup_passphrase \
  -in backups/mukellef-<zaman>.dump.enc -out /tmp/mukellef.dump
$DC exec -T postgres pg_restore -U postgres -d mukellef --clean --if-exists --no-owner --role=mukellef_owner < /tmp/mukellef.dump
shred -u /tmp/mukellef.dump
```

Veritabanı yedeği şifreli kolonları (kurum şifreleri, T.C. kimlik no) yine şifreli içerir; geri yüklenen sistemin aynı OpenBao anahtarına ihtiyacı vardır. OpenBao verisini (`openbao-data` volume) ve açma anahtarlarını ayrıca yedekleyin.

### Güncelleme

```bash
git pull && $DC up -d --build      # migrate servisi şemayı günceller; api/worker yeni imajla başlar
```

## Bilinen sınırlar

- MinIO resmi Docker imajı yayımlanmadığından yerleşik nesne deposu yok; yedekler dosya olarak üretilir ve dışarı senkronlanır.
- OpenBao tek düğüm (Raft). Yüksek erişilebilirlik için 3 düğüme çıkarılabilir.
- Caddy erişim günlüğü kapalı (adres satırında kişisel veri olabilir); API kendi günlüğünü redakte ederek yazar.
