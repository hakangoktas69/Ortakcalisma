<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../README.md) › **Docker ve Kubernetes**
<!-- /gezinti -->

# deploy — Docker ve Kubernetes

Uygulama aynı imajlarla iki biçimde kurulur: **Docker Compose** (`compose/`, geliştirme, demo, küçük kurulum) ya da **Kubernetes** (`k8s/`, Helm; kurulumda seçimli, D10). Gerekçe ve boyutlandırma: [hedef-mimari/04](../docs/hedef-mimari/04-dagitim-compose-kubernetes.md). İlk kez çalıştıracaksan önce [başlangıç rehberi](../docs/gelistirici-rehberi/baslangic.md).

## Compose yığını

Yığını doğrudan `docker compose` ile değil, sırları ve sırayı yöneten betikle kullan:

| Komut | Ne yapar |
|---|---|
| `node tools/deploy/yigin.mjs up` | Sırları tamamlar, imajları derler, altyapıyı başlatır, migration ve demo hesabını kurar, uygulamayı açar → `http://localhost:8080` |
| `node tools/deploy/yigin.mjs gelistir` | `up` + altyapı portlarını yalnız `127.0.0.1`'e açar (`compose/compose.gelistirme.yml`) + `apps/web/.env.local`'i yazar; ardından `pnpm --filter @eworks/web dev` → `http://127.0.0.1:8765` |
| `node tools/deploy/yigin.mjs web-env` | Yalnız `apps/web/.env.local`'i yeniden yazar |
| `node tools/deploy/yigin.mjs up --gelistirme-kapat` | Geliştirme kipini kapatır (altyapı portları yeniden kapanır). `gelistir` kipi `.env`'de (`GELISTIRME_KATMANI=1`) hatırlanır; sonraki `up`, `test`, `e2e`, `down` portları korur |
| `node tools/deploy/yigin.mjs test` | Entegrasyon, pgTAP ve Python testleri yığının ağında |
| `node tools/deploy/yigin.mjs e2e` | Arayüz kabul testleri (dört ekran) |
| `node tools/deploy/yigin.mjs down` / `down --sil` | Durdurur / durdurup tüm verileri siler |
| `node tools/deploy/yigin.mjs sirlar` | Yalnız `compose/.env`'i üretir ya da eksik sırları tamamlar |
| `node tools/deploy/yigin.mjs helm` | Helm şablonunu doğrular (`helm lint` + `template`, container'da) |

### Servisler

| Servis | Ne | Dışarıdan erişim |
|---|---|---|
| `web` | Next.js portal + BFF ([apps/web](../apps/web/CLAUDE.md)) | `WEB_PORT` (vars. 8080) |
| `worker` | Outbox taşıyıcı, kurum sonucu uygulayıcı, temizlik ([apps/worker](../apps/worker/README.md)) | yok |
| `integration` | Kurum entegrasyonu: Playwright robotu + servis yolu, CAPTCHA OCR ([services/integration](../services/integration/README.md)) | yok |
| `fake-gib` | Sahte GİB (yalnız `demo` profili; gerçek GİB'e gidilmez) | yok |
| `db-control` | Kontrol düzlemi Postgres: ofis dizini, shard eşlemesi, kimlik | geliştirme: `127.0.0.1:54320` |
| `db-shard-01`, `db-shard-02` | Kiracı verisi (Vault dahil) | geliştirme: `127.0.0.1:54321`, `54322` |
| `auth` | GoTrue (kimlik doğrulama) | geliştirme: `127.0.0.1:59999` |
| `redis` | Oturumlar, hız sınırlayıcı | geliştirme: `127.0.0.1:56379` |
| `rabbitmq` | İş kuyruğu | yok |
| `s3` | Belge deposu (SeaweedFS, S3 uyumlu) | geliştirme: `127.0.0.1:58333` |
| `migrate`, `hesap-ac` | Tek seferlik görevler (`gorev` profili): şema, demo ofisi | — |

Her servisin bellek sınırı vardır; uygulama container'ları salt okunur dosya sistemi ve en az yetkiyle çalışır (`compose/compose.yml`).

### Ayarlar ve sırlar

- `compose/.env` (git'e girmez): veritabanı parolaları, anahtarlar, `DEMO_SIFRE`. `yigin.mjs` yoksa güçlü rastgele değerlerle üretir; şablon [compose/.env.example](compose/.env.example).
- Sık değiştirilenler (`.env`'e eklenir):

| Değişken | Varsayılan | Ne |
|---|---|---|
| `WEB_PORT`, `PUBLIC_URL` | `8080`, `http://localhost:8080` | Docker'daki web'in portu ve adresi |
| `GELISTIRME_DB_CONTROL_PORT`, `GELISTIRME_DB_SHARD_01_PORT`, `GELISTIRME_DB_SHARD_02_PORT`, `GELISTIRME_AUTH_PORT`, `GELISTIRME_REDIS_PORT`, `GELISTIRME_S3_PORT` | `54320`, `54321`, `54322`, `59999`, `56379`, `58333` | `gelistir` katmanının yerel portları (çakışırsa değiştir, sonra `yigin.mjs gelistir`) |
| `GIB_SAHTE_SUNUCU` | `http://fake-gib:8090` | Boşsa robot gerçek GİB'e gider — yalnız [canlı doğrulamada](../docs/gelistirici-rehberi/canli-dogrulama.md) |
| `GIB_ISTEK_DK` | `60` | Kuruma giden istek/dakika (merkezi hız sınırı) |
| `GIB_ERISIM_YOLU`, `ERISIM_GIB_EBEYANNAME`, `ERISIM_GIB_IVD`, `SGK_ERISIM_YOLU` | `servis` | Oturum sonrası kurum erişim yolu `robot` \| `servis` (D38, [02 §1b](../docs/hedef-mimari/02-kurum-entegrasyon-robotu.md#1b-erişim-yolu-parametresi-d38)) |

### İmajlar

`docker/node.Dockerfile` (hedefler: `web`, `worker`, `ci`, `e2e`) ve `docker/integration.Dockerfile` (Playwright + Python + OCR modeli). Derlemeyi `yigin.mjs` yapar.

## Kubernetes

`k8s/eworks` Helm şablonudur (iskelet; `helm lint` yeşil, kümede henüz koşulmadı). Sırlar Secret'lardan gelir, `GIB_SAHTE_SUNUCU` üretimde yoktur, `EWORKS_ORTAM=uretim`. Ayrıntı: [k8s/eworks/values.yaml](k8s/eworks/values.yaml).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../README.md) › **Docker ve Kubernetes**
<!-- /gezinti -->
