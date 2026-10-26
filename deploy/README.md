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
| `node tools/deploy/yigin.mjs debug` | `gelistir` + işçi Node inspector (`127.0.0.1:9230`) ve entegrasyon debugpy (`127.0.0.1:5678`); VS Code "Docker: … bağlan" ([başlangıç §7](../docs/gelistirici-rehberi/baslangic.md#7-dockerda-hata-ayıklama)) |
| `node tools/deploy/yigin.mjs uretim` | VPS üretim kurulumu: Caddy ile otomatik HTTPS, yalnız 80/443 dışarı, sahte GİB yok ([VPS rehberi](../docs/gelistirici-rehberi/vps-kurulum.md)) |
| `node tools/deploy/yigin.mjs hesap-ac ofis …` | İlk ofis ve yöneticisi (parola `HESAP_SIFRE` ortamından) |
| `node tools/deploy/yigin.mjs up --kip demo` | Kipi değiştirir: `demo` \| `gelistirme` \| `debug` \| `uretim`. Değer ve üretim ön koşulları yazılmadan önce denetlenir; üretimden çıkmak `--uretimden-cik` ister. `test` ve `e2e` üretim kipinde çalışmaz |
| `node tools/deploy/yigin.mjs test` | Entegrasyon, pgTAP ve Python testleri yığının ağında |
| `node tools/deploy/yigin.mjs e2e` | Arayüz kabul testleri (dört ekran) |
| `node tools/deploy/yigin.mjs down` / `down --sil` | Durdurur / durdurup tüm verileri siler |
| `node tools/deploy/yigin.mjs sirlar` | Yalnız `compose/.env`'i üretir ya da eksik sırları tamamlar |
| `node tools/deploy/yigin.mjs helm` | Helm şablonunu doğrular (`helm lint` + `template`, container'da) |

### Kipler

Her kipin `.env` ayarları, terminal ve VS Code adımları: [Yığın kipleri rehberi](../docs/gelistirici-rehberi/kipler.md). Kip `deploy/compose/.env`'de (`YIGIN_KIPI`) hatırlanır; sonraki `up`, `test`, `e2e`, `down` aynı katmanlarla çalışır. TDD özellik durumu (kırmızı/yeşil rozetler) yalnız `gelistirme` ve `debug` kipinde görünür; `demo` ve `uretim`'de portal normal görünümdedir. `e2e` rozetleri doğruladığı için koşu süresince açar, sonraki `up` kipin görünümüne döner (D39, `OZELLIK_DURUMU_GOSTER`). Üretim dışındaki kipte kip adı logo yanında yazar.

| Kip | Katmanlar | Ne zaman |
|---|---|---|
| `demo` (vars.) | `compose.yml` | Uygulamayı denemek, testler; sahte GİB ve demo hesabı; portal normal görünümde |
| `gelistirme` | + `compose.gelistirme.yml` | Docker'sız web (8765); altyapı portları 127.0.0.1'de; TDD rozetleri (kırmızı "Geliştiriliyor") görünür |
| `debug` | + `compose.gelistirme.yml` + `compose.debug.yml` | VS Code ile Docker'daki işçi/entegrasyonda hata ayıklama; **yalnız kendi bilgisayarında** |
| `uretim` | + `compose.uretim.yml` (Caddy) | VPS canlı ortam; sahte GİB ve demo hesabı yok |

Aynı makinede ikinci bir yığın denemek için: `YIGIN_PROJE=<ad> YIGIN_ENV=deploy/compose/.env.<ad> node tools/deploy/yigin.mjs …` (ayrı veri ve sırlar).

### Servisler

| Servis | Ne | Dışarıdan erişim |
|---|---|---|
| `web` | Next.js portal + BFF ([apps/web](../apps/web/CLAUDE.md)) | `WEB_PORT` (vars. 8080) |
| `worker` | Outbox taşıyıcı, kurum sonucu uygulayıcı, temizlik ([apps/worker](../apps/worker/README.md)) | `debug`: inspector `127.0.0.1:9230` |
| `integration` | Kurum entegrasyonu: Playwright robotu + servis yolu, CAPTCHA OCR ([services/integration](../services/integration/README.md)) | `debug`: debugpy `127.0.0.1:5678` |
| `fake-gib` | Sahte GİB (yalnız `demo` profili; gerçek GİB'e gidilmez) | yok |
| `db-control` | Kontrol düzlemi Postgres: ofis dizini, shard eşlemesi, kimlik | geliştirme: `127.0.0.1:54320` |
| `db-shard-01`, `db-shard-02` | Kiracı verisi (Vault dahil) | geliştirme: `127.0.0.1:54321`, `54322` |
| `auth` | GoTrue (kimlik doğrulama) | geliştirme: `127.0.0.1:59999` |
| `redis` | Oturumlar, hız sınırlayıcı | geliştirme: `127.0.0.1:56379` |
| `rabbitmq` | İş kuyruğu | yok |
| `s3` | Belge deposu (SeaweedFS, S3 uyumlu) | geliştirme: `127.0.0.1:58333` |
| `caddy` | Ters vekil, otomatik HTTPS (yalnız `uretim`) | `80`, `443` (`URETIM_HTTP_PORT`, `URETIM_HTTPS_PORT`) |
| `migrate`, `hesap-ac` | Tek seferlik görevler (`gorev` profili): şema, demo ofisi | — |

Her servisin bellek sınırı vardır; uygulama container'ları salt okunur dosya sistemi ve en az yetkiyle çalışır (`compose/compose.yml`).

### Ayarlar ve sırlar

- `compose/.env` (git'e girmez): veritabanı parolaları, anahtarlar, `DEMO_SIFRE`. `yigin.mjs` yoksa güçlü rastgele değerlerle üretir; şablon [compose/.env.example](compose/.env.example).
- Sık değiştirilenler (`.env`'e eklenir):

| Değişken | Varsayılan | Ne |
|---|---|---|
| `WEB_PORT`, `PUBLIC_URL` | `8080`, `http://localhost:8080` | Docker'daki web'in portu ve adresi |
| `GELISTIRME_DB_CONTROL_PORT`, `GELISTIRME_DB_SHARD_01_PORT`, `GELISTIRME_DB_SHARD_02_PORT`, `GELISTIRME_AUTH_PORT`, `GELISTIRME_REDIS_PORT`, `GELISTIRME_S3_PORT` | `54320`, `54321`, `54322`, `59999`, `56379`, `58333` | `gelistir` katmanının yerel portları (çakışırsa değiştir, sonra `yigin.mjs gelistir`) |
| `HATA_AYIKLAMA_ISCI_PORT`, `HATA_AYIKLAMA_PYTHON_PORT` | `9230`, `5678` | `debug` kipinin portları (değiştirirsen `.vscode/launch.json`'da da) |
| `EWORKS_ALAN_ADI`, `PUBLIC_URL` | — | `uretim`: alan adı ve `https://<alan>` (zorunlu, betik denetler) |
| `URETIM_HTTP_PORT`, `URETIM_HTTPS_PORT` | `80`, `443` | `uretim`: Caddy'nin dış portları |
| `GIB_SAHTE_SUNUCU` | `http://fake-gib:8090` | Boşsa robot gerçek GİB'e gider — yalnız [canlı doğrulamada](../docs/gelistirici-rehberi/canli-dogrulama.md) |
| `GIB_ISTEK_DK` | `60` | Kuruma giden istek/dakika (merkezi hız sınırı) |
| `GIB_ERISIM_YOLU`, `ERISIM_GIB_EBEYANNAME`, `ERISIM_GIB_IVD`, `SGK_ERISIM_YOLU` | `servis` | Oturum sonrası kurum erişim yolu `robot` \| `servis` (D38, [02 §1b](../docs/hedef-mimari/02-kurum-entegrasyon-robotu.md#1b-erişim-yolu-parametresi-d38)) |

### İmajlar

`docker/node.Dockerfile` (hedefler: `web`, `worker`, `ci`, `e2e`) ve `docker/integration.Dockerfile` (hedefler: `uretim`, `debug` = + debugpy; Playwright + Python + OCR modeli). Derlemeyi `yigin.mjs` yapar; üretimde imajlar sunucuda kaynaktan derlenir ([VPS rehberi](../docs/gelistirici-rehberi/vps-kurulum.md#5-kur-ve-başlat-canlı-build)).

## Kubernetes

`k8s/eworks` Helm şablonudur (iskelet; `helm lint` yeşil, kümede henüz koşulmadı). Sırlar Secret'lardan gelir, `GIB_SAHTE_SUNUCU` üretimde yoktur, `EWORKS_ORTAM=uretim`. Ayrıntı: [k8s/eworks/values.yaml](k8s/eworks/values.yaml).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../README.md) › **Docker ve Kubernetes**
<!-- /gezinti -->
