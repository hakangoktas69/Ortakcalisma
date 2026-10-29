<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Başlangıç rehberi](baslangic.md) › **Yığın kipleri**
<!-- /gezinti -->

# Yığın kipleri: demo, gelistirme, debug, uretim

Uygulama her zaman aynı komutla yönetilir: `node tools/deploy/yigin.mjs`. Bu komutun dört **kipi** vardır. Kip, hangi Docker katmanlarının açılacağını, hangi portların açılacağını ve portalın nasıl görüneceğini belirler. Bu sayfa her kip için ne ayarlanacağını, terminalden ve VS Code'dan nasıl açılacağını ve nasıl kapatılacağını anlatır.

Kurulum ve ilk çalıştırma: [başlangıç rehberi](baslangic.md). Terimler: [terimler.md](terimler.md).

## 1. Hangi kip, ne zaman

| Kip | Ne zaman | Portal adresi | Portalın görünümü (D39) | Logo yanında |
|---|---|---|---|---|
| `demo` (varsayılan) | Uygulamayı denemek, birine göstermek, testçi olarak elle sınamak | `http://localhost:8080` | Normal: "Tamamlandı" / "Geliştiriliyor" rozeti ve kırmızı çerçeve yok; yapılmamış sayfa "yakında" der | `DEMO` |
| `gelistirme` | Kodu değiştirirken: web'i Docker'sız çalıştırıp değişikliği anında görmek | `http://127.0.0.1:8765` (Docker'sız web) ve `http://localhost:8080` (Docker'daki web, eski kod) | TDD görünümü: rozetler ve kırmızı çerçeve görünür | `GELİŞTİRME` |
| `debug` | Docker'daki işçi (Node) ya da kurum entegrasyonunda (Python) hata ayıklamak | `gelistirme` ile aynı | TDD görünümü | `DEBUG` |
| `uretim` | Canlı sunucu (VPS); kendi bilgisayarında yalnız deneme için | `https://<alan adı>` | Normal | Etiket yok |

Ortak kurallar:

- Kip `deploy/compose/.env` içindeki `YIGIN_KIPI` satırında **hatırlanır**. Bu satırı elle yazma; betik yazar. Sonraki `up`, `test`, `e2e`, `down` aynı kiple çalışır.
- Kipe bağlı web ayarlarını (`YIGIN_KIPI`, `OZELLIK_DURUMU_GOSTER`) betik her çalıştırmada kipten yeniden üretir. `.env`'e ya da kabuğa elle yazma; yazsan da dikkate alınmaz.
- `demo`, `gelistirme` ve `debug` kiplerinde **sahte GİB** ve **demo hesabı** vardır (`demo@eworks.test`, parola `.env` → `DEMO_SIFRE`; [başlangıç §3](baslangic.md#demo-hesabı-ve-test-şifreleri)). Gerçek GİB'e istek gitmez.
- **Sentetik (sahte) veri yalnız `demo` kipinde** vardır. `gelistirme`, `debug` ve `uretim` kiplerinde ekranlar kurumdan çekilen **gerçek** veriyle dolar: geliştirici firma kartından kurum hesabını girer, mükellef onayını kaydeder ve ekrandaki "güncelle" düğmesiyle çeker. Kural iki yerde denetlenir: `yigin.mjs` görevi yalnız demo kipinde çağırır, görev de kendi içinde `YIGIN_KIPI`'yi denetleyip demo dışında veritabanına dokunmadan durur.
- Demo dışı bir kipte ekranı **gerçek GİB**'den doldurmak için `.env`'de `GIB_SAHTE_SUNUCU=` (boş) verilir; o zaman `*.gib.gov.tr` istekleri gerçek kuruma gider. Varsayılan sahte GİB'dir, çünkü geliştirme sırasında kuruma istek gitmemelidir.
- `uretim` kipinde sahte GİB, demo hesabı ve dışarı açık altyapı portu yoktur. `test`, `e2e`, `gelistir`, `debug` komutları bu kipte reddedilir.

## 2. demo

Uygulamayı olduğu gibi çalıştırmak içindir. Kod değişikliği, imaj yeniden derlenince görünür.

**`.env` ayarı:** gerekmez. İlk `up` dosyayı güçlü rastgele sırlarla üretir. Web portu 8080 doluysa `WEB_PORT` ve `PUBLIC_URL`'i birlikte değiştir (ör. `WEB_PORT=8081`, `PUBLIC_URL=http://localhost:8081`).

**Terminal (Docker):**

```bash
node tools/deploy/yigin.mjs up                # kip zaten demo ise
node tools/deploy/yigin.mjs up --kip demo     # başka kipten demo'ya geç
```

`✔ Yığın ayakta (kip: demo): http://localhost:8080` görünce tarayıcıda aç.

**VS Code:** Terminal → Run Task… → **Yığın: demo kipine dön** (başka kipten geçerken) ya da **Yığın: up**. Hata ayıklama yapılandırması kullanılmaz.

**Bilmen gerekenler:**

- Kodu değiştirdiysen `up`'ı yeniden çalıştır; imajlar yeniden derlenir.
- `node tools/deploy/yigin.mjs e2e` kabul testleri rozetleri denetlediği için koşu süresince web'i TDD görünümüne alır. Koşu başarılı biterse web kendiliğinden normal görünüme döner. Test kırmızıyla biterse rozetler açık kalır; `up` ile normale dön.

## 3. gelistirme

Web arayüzünde ve BFF'te çalışırken kullanılır. Altyapı (veritabanları, kimlik, Redis, S3) Docker'da kalır; web Docker'sız çalışır ve kaydettiğin değişiklik tarayıcıda anında görünür.

**`.env` ayarı:** gerekmez. Altyapı portları yalnız bu bilgisayara (127.0.0.1) açılır: 54320, 54321, 54322 (veritabanları), 59999 (kimlik), 56379 (Redis), 58333 (S3). Bilgisayarında başka bir program bunlardan birini kullanıyorsa `.env`'de ilgili satırı aç ve değiştir (`GELISTIRME_DB_CONTROL_PORT=…` gibi, liste [.env.example](../../deploy/compose/.env.example)'da), sonra kipi yeniden kur.

**Terminal (Docker + Docker'sız web):**

```bash
node tools/deploy/yigin.mjs gelistir          # yığın + 127.0.0.1 portları + apps/web/.env.local
pnpm --filter @eworks/web dev                 # → http://127.0.0.1:8765  (PowerShell: pnpm.cmd --filter @eworks/web dev)
```

`gelistir`, web'in yığına bağlanacağı `apps/web/.env.local` dosyasını da yazar. Bu dosya sır içerir, git'e girmez.

**VS Code:**

1. Terminal → Run Task… → **Yığın: gelistir**. Terminalde `✔ Web ortamı yazıldı` görünce biter.
2. Terminal → Run Task… → **Web: dev (8765)**, ya da hata ayıklayıcıyla çalıştırmak için Run and Debug → **Web: sunucu + tarayıcı (8765)** → F5 ([başlangıç §6](baslangic.md#6-vs-code-ile-hata-ayıklama-dockersız)).

**Bilmen gerekenler:**

- Rozetleri (kırmızı "Geliştiriliyor", yeşil "Tamamlandı") 8765'te görmüyorsan `apps/web/.env.local` eskidir: `node tools/deploy/yigin.mjs web-env` çalıştır ve web'i yeniden başlat.
- 8080'deki Docker web'i aynı veritabanını kullanır ama son derlenen kodla çalışır. Geliştirirken 8765'i kullan.
- `apps/worker`, `services/integration` ya da migration değiştiyse: `node tools/deploy/yigin.mjs up` (kip korunur, imajlar yeniden derlenir).

## 4. debug

`gelistirme`'nin her şeyi, ek olarak Docker'daki işçiye ve kurum entegrasyonuna hata ayıklayıcı bağlanabilir. **Yalnız kendi bilgisayarında** kullan: hata ayıklayıcıya bağlanan, container'da kod çalıştırabilir.

**`.env` ayarı:** gerekmez. Hata ayıklama portları 127.0.0.1:9230 (işçi, Node) ve 127.0.0.1:5678 (entegrasyon, Python). Doluysa `.env`'de `HATA_AYIKLAMA_ISCI_PORT` / `HATA_AYIKLAMA_PYTHON_PORT` değiştir; bu durumda [.vscode/launch.json](../../.vscode/launch.json)'daki "Docker: …" yapılandırmalarının portunu da aynı değere getir.

**Terminal (Docker):**

```bash
node tools/deploy/yigin.mjs debug             # gelistir + işçi 9230 + entegrasyon 5678
pnpm --filter @eworks/web dev                 # web'de de çalışacaksan (8765)
```

**VS Code:**

1. Terminal → Run Task… → **Yığın: debug**.
2. Run and Debug → **Docker: işçiye bağlan (9230)** ya da **Docker: entegrasyona bağlan (Python 5678)** → F5. Python için "Python Debugger" eklentisi kurulu olmalı.
3. Web için ayrıca **Web: sunucu + tarayıcı (8765)**. Docker'daki web'e bağlanılmaz; oradaki kod derlenmiş çıktıdır ([başlangıç §7](baslangic.md#7-dockerda-hata-ayıklama)).

**Bilmen gerekenler:**

- İşçi ya da entegrasyon kodunu değiştirdiysen container eski kodla çalışır: `node tools/deploy/yigin.mjs debug` (imajlar yeniden derlenir), sonra yeniden bağlan.
- Bitince **Yığın: demo kipine dön** (`up --kip demo`): hata ayıklama ve altyapı portları kapanır.

## 5. uretim

Canlı sunucu kipidir. Sunucuda kurulumun tamamı: [VPS rehberi](vps-kurulum.md). Bu kipte VS Code görevi ve hata ayıklama yapılandırması **yoktur**: sunucuda komutlar SSH terminalinde çalışır, hata ayıklama yapılmaz.

**`.env` ayarı (zorunlu):**

| Satır | Değer | Neden |
|---|---|---|
| `EWORKS_ALAN_ADI` | `portal.ornek.com.tr` | Caddy bu ad için HTTPS sertifikası alır |
| `PUBLIC_URL` | `https://portal.ornek.com.tr` | Giriş ve çerezler bu adrese bağlıdır; `https://` ile ve alan adıyla aynı olmalı |
| `URETIM_HTTP_PORT`, `URETIM_HTTPS_PORT` | Boş bırak (80, 443) | Yalnız kendi bilgisayarında denerken değiştir |
| `GIB_SAHTE_SUNUCU` | Satır olmamalı | Doluysa kurulum başlamaz |

Eksik ya da yanlışsa betik hiçbir şeyi başlatmadan hangi satırın düzeltileceğini yazar.

**Terminal (sunucuda):**

```bash
node tools/deploy/yigin.mjs uretim
HESAP_SIFRE='…' node tools/deploy/yigin.mjs hesap-ac ofis --ofis "Ofis adı" --eposta … --ad "Ad Soyad"   # ilk yönetici
```

**Kendi bilgisayarında denemek** (üretim görünümünü ve HTTPS'i görmek için): mevcut demo yığınını ve verisini bozmamak için **ayrı bir yığın** aç.

```bash
export YIGIN_PROJE=eworks-uretim YIGIN_ENV=deploy/compose/.env.uretim
node tools/deploy/yigin.mjs sirlar
# deploy/compose/.env.uretim'e ekle: EWORKS_ALAN_ADI=localhost, PUBLIC_URL=https://localhost
node tools/deploy/yigin.mjs uretim            # → https://localhost (Caddy'nin yerel sertifikası: tarayıcı uyarısını kabul et)
node tools/deploy/yigin.mjs down --sil        # deneme bitince; sonra: unset YIGIN_PROJE YIGIN_ENV
```

80/443 doluysa `URETIM_HTTPS_PORT=8443` ve `PUBLIC_URL=https://localhost:8443` gibi ikisini birlikte değiştir. PowerShell'de `export` yerine: `$env:YIGIN_PROJE='eworks-uretim'; $env:YIGIN_ENV='deploy/compose/.env.uretim'`. Bu yığında demo hesabı yoktur; girmek için yukarıdaki `hesap-ac` ile yönetici aç.

**Bilmen gerekenler:**

- Demo ya da geliştirme verisi olan yığını `uretim`'e çevirme: demo hesabı üretim veritabanında kalır. Sunucuda önce `up` çalıştırma ([VPS §5](vps-kurulum.md#5-kur-ve-başlat-canlı-build)).
- `uretim`'den başka kipe geçmek demo hesabını ve sahte GİB'i açar; betik bunu yalnız `--uretimden-cik` bayrağıyla yapar. Sunucuda kullanma.

## 6. Kipler arası geçiş özeti

| Şu an → istenen | Terminal | VS Code görevi |
|---|---|---|
| herhangi → `demo` | `node tools/deploy/yigin.mjs up --kip demo` | Yığın: demo kipine dön |
| herhangi → `gelistirme` | `node tools/deploy/yigin.mjs gelistir` | Yığın: gelistir |
| herhangi → `debug` | `node tools/deploy/yigin.mjs debug` | Yığın: debug |
| aynı kipte yeniden derle | `node tools/deploy/yigin.mjs up` | Yığın: up |
| `demo` / `gelistirme` / `debug` → `uretim` | `node tools/deploy/yigin.mjs uretim` (önce `.env`, §5) | — |
| `uretim` → başka | `… up --kip demo --uretimden-cik` (yalnız deneme yığınında) | — |
| durdur | `node tools/deploy/yigin.mjs down` (veri kalır), `down --sil` (veri silinir) | Yığın: down |

Hangi kipte olduğunu görmek için: portalda logonun yanındaki etiket, ya da `grep '^YIGIN_KIPI=' deploy/compose/.env` (PowerShell: `Select-String -Path deploy\compose\.env -Pattern '^YIGIN_KIPI='`). Satır yoksa kip `demo`'dur.

## 7. Sorun giderme

| Belirti | Neden | Çözüm |
|---|---|---|
| Demo'da kırmızı "Geliştiriliyor" rozetleri görünüyor | Son `e2e` koşusu kırmızıyla bitti | `node tools/deploy/yigin.mjs up` |
| 8765'te rozet ya da `GELİŞTİRME` etiketi yok | `apps/web/.env.local` bu sürümden eski | `node tools/deploy/yigin.mjs web-env`, web'i yeniden başlat |
| `gelistir` "port is already allocated" diyor | 127.0.0.1 portlarından biri dolu | `.env`'de ilgili `GELISTIRME_*_PORT`'u değiştir (§3) |
| "Docker: … bağlan" bağlanamıyor | Yığın `debug` kipinde değil ya da port farklı | `node tools/deploy/yigin.mjs debug`; port değiştiyse `launch.json` (§4) |
| `uretim` "EWORKS_ALAN_ADI …" / "PUBLIC_URL …" hatasıyla duruyor | `.env` eksik | §5 tablosu |
| `test`/`e2e` "üretim kipinde çalıştırılmaz" diyor | Yığın `uretim` kipinde | Testleri geliştirme bilgisayarında, demo/gelistirme kipinde koş |

Genel sorunlar: [başlangıç §12](baslangic.md#12-sorun-giderme). Compose katmanlarının teknik ayrıntısı: [deploy/README.md](../../deploy/README.md#kipler).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Başlangıç rehberi](baslangic.md) › **Yığın kipleri**
<!-- /gezinti -->
