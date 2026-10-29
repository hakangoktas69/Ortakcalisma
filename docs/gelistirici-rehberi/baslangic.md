<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **Başlangıç rehberi**
<!-- /gezinti -->

# Başlangıç: kur, çalıştır, değiştir, test et

Bu rehber projeye yeni katılan ve yazılım geliştirmede deneyimi az olan ekip üyeleri içindir. Sonunda uygulamayı kendi bilgisayarında çalıştırmış, demo hesabıyla girmiş, kodda bir değişikliği anında görmüş ve testleri koşmuş olursun. Komutlar Windows'ta **Git Bash**'te yazılır. PowerShell'de de çalışır; tek fark `pnpm` yerine `pnpm.cmd` yazmaktır (§5).

Kodu genelde Claude Code ya da Codex ile değiştirirsin: [claude-codex.md](claude-codex.md#ajana-iş-verdiğinde-ne-olur-gelistir). Bu rehber, ajan çalışırken neyin olup bittiğini anlaman ve sonucu kendi gözünle doğrulaman içindir. Bilmediğin terimler: [terimler.md](terimler.md).

Belgelerin en üstünde ve en altında `README › Genel bakış › …` biçiminde bir yol satırı bulunur. Bir bağlantıyla başka belgeye geçtikten sonra bu satırdaki üst belgelere tıklayarak geri dönebilirsin (VS Code önizlemesinde "geri" düğmesi yoktur).

## 1. Gerekenler

| Araç | Neden | Not |
|---|---|---|
| **Git** | Kodu almak ve göndermek | Windows'ta Git for Windows (Git Bash ile gelir) |
| **Docker Desktop** | Veritabanı, kimlik, kuyruk, depo ve uygulamanın kendisi container'da çalışır | WSL 2 altyapısıyla. Ayarlar → Resources: en az **6 GB bellek**, **25 GB boş disk** (yığın boştayken ~1 GB bellek kullanır; tarayıcılı testlerde artar; imajlar ~12 GB) |
| **Node.js 24** | Komut betikleri, web uygulaması, testler | Sürüm `.nvmrc`'de. Windows'ta `winget install OpenJS.NodeJS` ya da nvm-windows. **Node 20 ile `corepack` pnpm'i indiremez** (§12) |
| **pnpm** | Paket yöneticisi | Ayrıca kurma; Node ile gelen `corepack` doğru sürümü (`package.json` → `packageManager`) kurar |

Windows'ta bir kez (yönetici gerekmez):

```bash
git config --global core.longpaths true   # eski/ arşivinde 260 karakteri aşan yollar var; yoksa clone/pull yarım kalır
```

## 2. İlk kurulum

```bash
git clone https://github.com/hakangoktas69/Ortakcalisma.git
cd Ortakcalisma
git switch yeniden-yapilanma        # yeniden yapılanma dev'e birleşene kadar güncel kod burada; sonra dev
corepack enable                     # yönetici ister (Program Files'a yazar); olmazsa her komutun başına "corepack " yaz: corepack pnpm install
pnpm install                        # bağımlılıklar + git kancaları (tools/git-hooks)
pnpm verify                         # tip denetimi, mimari kurallar, birim testleri, hafıza, belge bağlantıları — hepsi ✔ olmalı
```

Depoyu yeniden yapılanmadan (24.10.2026) önce klonladıysan: [ekip hafızası, pull sonrası adımlar](../ai/memory/eworks-yeniden-yapilanma.md).

## 3. Uygulamayı Docker'da çalıştır

```bash
node tools/deploy/yigin.mjs up
```

İlk seferde imajlar derlenir (10–20 dk); sonrakilerde birkaç dakika. Komut ne yapar:

1. `deploy/compose/.env` yoksa güçlü rastgele sırlarla üretir (veritabanı parolaları, anahtarlar). Bu dosya **commit edilmez**.
2. Altyapıyı başlatır: veritabanları, kimlik (GoTrue), Redis, RabbitMQ, S3.
3. Veritabanı şemasını kurar (migration), demo ofisini ve kullanıcısını açar; **yalnız `demo` kipinde** ayrıca **sentetik demo verisini** (örnek mükellef kartları, e-Tebligat kayıtları, GİB sözleşmeleri, beyannameler, SGK bildirimleri, beyanname/tahakkuk PDF'leri, görevler, notlar, kurum hesapları ve mükellef onayları) ekler. `gelistirme` ve `debug` kiplerinde ekranlar boş başlar ve kurumdan çekilen gerçek veriyle dolar. Veri gerçek değildir: unvan ve kişi adları üretilir, VKN/TCKN sahtedir (TCKN 99 ile başlar). Tohum ofis adından türetilir: aynı ofis her koşuda aynı listeyi alır (var olan kayıtlar atlanır), farklı ofisler çakışmayan kimlikler alır. Mükellef açılamazsa komut hata verir ve yığın kurulumu durur — sessizce boş ekranla devam etmez.
4. Uygulamayı başlatır: web, işçi, kurum entegrasyonu ve **sahte GİB** (gerçek GİB'e hiçbir istek gitmez).

Bitince `✔ Yığın ayakta (kip: demo): http://localhost:8080` yazar. Tarayıcıda aç ve demo hesabıyla gir.

> Yığının dört kipi vardır: `demo` (bu bölüm), `gelistirme` (§4), `debug` (§7), `uretim` (§11). Her kip için `.env` ayarları, terminal ve VS Code adımları, kipler arası geçiş: **[Yığın kipleri](kipler.md)**.

### Demo hesabı ve test şifreleri

Bu hesaplar yalnız kendi bilgisayarındaki demo/test kurulumu içindir; üretimde (VPS) demo hesabı ve sahte GİB açılmaz.

| Ne | Değer | Nereden |
|---|---|---|
| Portal e-postası | `demo@eworks.test` | Sabit. `.env`'de `DEMO_EPOSTA=` satırı varsa o adres geçerlidir |
| Portal parolası | Her bilgisayarda farklı, rastgele | `deploy/compose/.env` → `DEMO_SIFRE=` satırında `=`'den sonraki kısmın tamamı |
| Demo ofisi / kullanıcının rolü | "Demo Mali Müşavirlik", ofis yöneticisi (`ofis_admin`) | `DEMO_OFIS`, `DEMO_AD` ile değiştirilebilir |
| Sahte GİB şifresi | `demo-gib-sifre` | Portalda "GİB hesabı" kaydederken: kullanıcı kodu **herhangi** bir değer, şifre bu. Başka şifre "hatalı şifre" sonucunu verir (bu durumu sınamak için). `.env`'de `SAHTE_GIB_SIFRE` ile değiştirilebilir |

- E-posta yazıp herhangi bir parola denemek çalışmaz: parola yalnız `demo@eworks.test` hesabına aittir.
- Parolayı görmek: VS Code'da `deploy/compose/.env` dosyasını aç, ya da terminalde `grep '^DEMO_SIFRE=' deploy/compose/.env` (PowerShell: `Select-String -Path deploy\compose\.env -Pattern '^DEMO_SIFRE='`).
- `.env` ilk `up`/`gelistir`'de üretilir ve git'e girmez; her ekip üyesinin parolası farklıdır. Parolayı sohbete, belgeye, commit'e yazma.
- Hesap açıldıktan sonra `DEMO_SIFRE`'yi **değiştirme**: demo hesabı her kurulumda yeniden denenir ama parolası güncellenmez; kurulum `Kullanıcı var, parola farklı` hatasıyla durur. Eski değeri geri koy ya da tüm verileri silip baştan kur (`node tools/deploy/yigin.mjs down --sil`, sonra `up`).
- Arayüz kabul testleri (`yigin.mjs e2e`) demo hesabını kullanmaz: her koşuda kendi geçici ofisini, yöneticisini (`yonetici-…@eworks.test`) ve personelini rastgele parolayla açar. Testçi olarak elle sınarken demo hesabını kullan.
- Ek kullanıcı (ör. personel rolüyle sınamak için): `HESAP_SIFRE=… node tools/deploy/yigin.mjs hesap-ac uye --ofis-id <uuid> --eposta a@eworks.test --ad "Ad Soyad" --rol personel` (parola en az 12 karakter). Demo ofisinin kimliği (`<uuid>`) kurulum çıktısında `✔ Ofis hazır: …` satırındadır; komut argümansız çalışınca kullanımı yazar.

`demo` kipinde portal normal görünümündedir; henüz yapılmamış bölümler "yakında" der. Kırmızı çerçeveli, "Geliştiriliyor" rozetli TDD görünümü yalnız `gelistirme` / `debug` kipinde açılır (D39). Firmalar → "GİB'den güncelle" gibi kurum işleri sahte GİB'le çalışır.

## 4. Kod değiştirirken: geliştirme döngüsü

Docker'daki web (8080) derlenmiş bir imajdır; kod değişikliğini görmek için imajın yeniden derlenmesi gerekir. Web arayüzünde ve BFF'te çalışırken bunun yerine web'i **Docker'sız** çalıştır; kaydettiğin değişiklik tarayıcıda anında görünür:

```bash
node tools/deploy/yigin.mjs gelistir        # yığın + altyapı portları yalnız bu bilgisayarda (127.0.0.1) + apps/web/.env.local
pnpm --filter @eworks/web dev               # → http://127.0.0.1:8765 (aynı demo hesabı); PowerShell'de: pnpm.cmd --filter @eworks/web dev
```

VS Code'dan aynısı, komut yazmadan: §5.

- `gelistir`, `up`'ın yaptığı her şeyi yapar; ayrıca veritabanı, kimlik, Redis ve S3 portlarını **yalnız 127.0.0.1**'e açar (ağdaki başka bilgisayar erişemez) ve web'in bunlara bağlanacağı `apps/web/.env.local`'i yazar. Bu dosya sır içerir, git'e girmez.
- 8765, Eworks 2 pilot portalının (Mert) adresidir. Durdurmak için terminalde `Ctrl+C`.
- Docker'daki 8080 aynı veritabanını kullanır ama eski kodla çalışır; geliştirirken 8765'i kullan.
- Kip hatırlanır (`.env`: `YIGIN_KIPI`): sonraki `up`, `test`, `e2e` portları açık tutar. Normale dönmek için `node tools/deploy/yigin.mjs up --kip demo`. Port çakışması, rozetlerin görünmemesi gibi durumlar: [Yığın kipleri §3](kipler.md#3-gelistirme).

Başka bir yerde değişiklik yaptıysan:

| Değişen | Görmek için |
|---|---|
| `apps/web`, `packages/*` (web'in kullandığı) | `pnpm --filter @eworks/web dev` açıksa kendiliğinden |
| `apps/worker`, `services/integration`, `supabase/migrations` | `node tools/deploy/yigin.mjs up` (imajlar ve şema yeniden kurulur) |
| Yalnız Python entegrasyonu (hızlı test) | [services/integration/README.md](../../services/integration/README.md) |

Kod değiştirmenin kuralları ve adımları (önce test, sonra kod): [gelistir becerisi](../ai/beceriler/gelistir.md), [TDD nedir](tdd-nedir.md).

## 5. VS Code ile çalıştırma

### İlk açılış (bir kez)

1. **Docker Desktop'ı başlat** (görev çubuğunda balina simgesi "running" olmalı). Yığın komutları Docker olmadan çalışmaz.
2. VS Code'da **File → Open Folder** ile depo kökünü aç (`Ortakcalisma`). Alt klasörü açma; `.vscode` yapılandırması kökte.
3. Sağ altta "Bu depo için önerilen eklentiler" bildirimi çıkar → **Install All** ([.vscode/extensions.json](../../.vscode/extensions.json)): Docker, Python + Python Debugger (debugpy), Vitest, Playwright, Mermaid önizleme. Bildirim kaybolduysa: Extensions görünümü (`Ctrl+Shift+X`) → arama kutusuna `@recommended`.
4. **Terminali seç.** VS Code'un Windows'taki varsayılan terminali **PowerShell**'dir. Önerilen: Git Bash'i varsayılan yap, böylece bu rehberdeki komutlar olduğu gibi çalışır:
   - `Ctrl+Shift+P` → **Terminal: Select Default Profile** → **Git Bash**. Sonra açık terminali kapat (çöp kutusu simgesi) ve **Terminal → New Terminal** ile yenisini aç.
   - PowerShell'de kalırsan tek fark: `pnpm` yerine **`pnpm.cmd`** yaz (ör. `pnpm.cmd --filter @eworks/web dev`). Bilgisayarın PowerShell politikası (`AllSigned`) imzasız `pnpm.ps1`'i engeller; `pnpm.cmd` bu engele takılmaz. `node …`, `git …`, `docker …` komutları iki terminalde de aynıdır.

### Uygulamayı VS Code'dan çalıştır

Komut yazmadan, hazır görevlerle: **Terminal → Run Task…** → listeden seç ([.vscode/tasks.json](../../.vscode/tasks.json)). Görevler Windows'ta `pnpm.cmd`'yi kendileri kullanır; terminal seçiminden etkilenmez.

1. **Yığın: gelistir** — yığın Docker'da kurulur, altyapı portları 127.0.0.1'de açılır, `apps/web/.env.local` yazılır. İlk seferde 10–20 dk; terminalde `✔ Web ortamı yazıldı` görünce biter.
2. **Web: dev (8765)** — web Docker'sız başlar. Terminalde `✓ Ready` görünce tarayıcıda `http://127.0.0.1:8765` aç; demo hesabıyla gir (§3). Kaydettiğin her değişiklik sayfada anında görünür. Durdurmak için o terminalde `Ctrl+C`.
3. Hata ayıklayıcıyla çalıştırmak istersen 2. adım yerine **F5** (§6).

Tüm görevler:

| Görev | Ne yapar |
|---|---|
| Yığın: up | Tüm yığın Docker'da → `http://localhost:8080` (kod değişikliği için imaj yeniden derlenir) |
| Yığın: gelistir | Altyapı portları 127.0.0.1'de + `.env.local`; ardından "Web: dev (8765)" |
| Yığın: debug | `gelistir` + Docker'daki işçi ve entegrasyona hata ayıklayıcı bağlanabilir (§7) |
| Yığın: demo kipine dön | Geliştirme/hata ayıklama portlarını kapatır |
| Web: dev (8765) | Docker'sız web, anında yenilenir |
| pnpm test | Birim testleri |
| pnpm verify | Commit'ten önceki denetimler. Kısayolu: **Terminal → Run Test Task…** doğrudan bunu çalıştırır |
| Yığın: test / Yığın: e2e | Docker yığınına karşı testler (§8) |
| Yığın: down | Durdurur |

### Container'ları izle

Docker eklentisinin kenar çubuğundaki görünümünde çalışan container'ları görürsün. Bir container'a sağ tıkla: **View Logs** (günlükler), **Attach Shell** (içinde komut satırı), **Restart**. Container adları `eworks-<servis>-1` biçimindedir (ör. `eworks-worker-1`).

## 6. VS Code ile hata ayıklama (Docker'sız)

**Run and Debug** görünümü (`Ctrl+Shift+D`) → üstteki listeden yapılandırmayı seç → ▶ (ya da `F5`). Kesme noktası: satır numarasının soluna tıkla (kırmızı nokta). Durunca değişkenleri sol panelde görür, `F10` (sonraki satır), `F11` (içine gir), `F5` (devam) ile ilerlersin.

| Yapılandırma | Ne için | Ön koşul |
|---|---|---|
| **Web: sunucu + tarayıcı (8765)** | Web'i başlatır; sunucu kodunda (sayfalar, `app/api` uçları, `bff`, `packages/contexts/*`) **ve** tarayıcı kodunda (form bileşenleri) kesme noktaları birlikte çalışır; hazır olunca Chrome'u hata ayıklama kipinde açar | `Yığın: gelistir` bir kez çalışmış olmalı (`.env.local`); Chrome kurulu |
| **Web: yalnız sunucu (8765)** | Yalnız sunucu tarafı; tarayıcıyı kendin açarsın | aynı |
| **Web: tarayıcı (8765)** | Çalışan web'e (8765) yalnız tarayıcı tarafından bağlanır | Web zaten çalışıyor |
| **Birim testi: açık dosya (Vitest)** | Editörde açık test dosyasını hata ayıklayıcıyla koşar; test ya da test edilen kodda durur | Açık dosya `*.test.ts` |
| **Betik: açık dosya (Node 24)** | Açık `.ts`/`.mjs` betiğini (ör. `tools/…`) çalıştırır | Node 24 |

- Chrome yerine Edge kullanıyorsan "Web: tarayıcı" yapılandırmasında `"type": "chrome"` → `"type": "msedge"`; "sunucu + tarayıcı"da `"action": "debugWithChrome"` → `"debugWithEdge"`.
- `pnpm` bulunamadı hatası: VS Code'u kapatıp aç (PATH yenilenir) ya da `corepack enable` (§2).
- Windows'ta yapılandırmalar ve görevler `pnpm.cmd` kullanır: PowerShell'in `AllSigned` politikası imzasız `pnpm.ps1`'i engeller (§12).

## 7. Docker'da hata ayıklama

Docker'da çalışan **işçi** (Node, `apps/worker`) ve **kurum entegrasyonu** (Python, `services/integration`) için:

```bash
node tools/deploy/yigin.mjs debug     # gelistir + işçi Node inspector (127.0.0.1:9230), entegrasyon debugpy (127.0.0.1:5678)
```

Sonra Run and Debug'da:

| Yapılandırma | Bağlandığı | Kesme noktası koy |
|---|---|---|
| **Docker: işçiye bağlan (9230)** | Container'daki `node --inspect` | `apps/worker/src/*.ts` ve işçinin kullandığı `packages/contexts/*` (TypeScript kaynak doğrudan çalışır; satırlar birebir oturur) |
| **Docker: entegrasyona bağlan (Python 5678)** | Container'daki `debugpy` | `services/integration/src/eworks_integration/**.py` (ör. `transports/service/http_tasima.py`); kurum işi başlayınca (portalda "GİB'den güncelle") durur |

- İşçi her saniye outbox'ı yoklar; `apps/worker/src/main.ts` döngüsüne koyduğun kesme noktası hemen tutar. Durduğun sürece işçi bekler; `F5` ile sürdür.
- Hata ayıklama portları yalnız 127.0.0.1'dedir. `debug` kipi **yalnız kendi bilgisayarında** kullanılır: hata ayıklayıcıya bağlanan, container'da kod çalıştırabilir. Üretimde (VPS) bu katman hiç yoktur.
- Kod değiştirdiysen container'lar eski kodla çalışır: `node tools/deploy/yigin.mjs debug` (imajlar yeniden derlenir), sonra yeniden bağlan.
- **Docker'daki web'e bağlanma yapılandırması yok**, bilerek: oradaki web derlenmiş (sıkıştırılmış) çıktıdır, kesme noktaları kaynağa oturmaz. Web'i §6'daki gibi 8765'te hata ayıkla.
- Bitince: `node tools/deploy/yigin.mjs up --kip demo`. Port değiştirme ve geçişler: [Yığın kipleri §4](kipler.md#4-debug).

Depodaki [.vscode/launch.json](../../.vscode/launch.json) hazırdır, ayrıca bir şey eklemen gerekmez. İçeriği (yeni bir makinede ya da başka bir klasörde açarsan aynısını `.vscode/launch.json`'a koy; depodaki dosya esastır):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Web: sunucu + tarayıcı (8765)",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter @eworks/web dev",
      "windows": { "command": "pnpm.cmd --filter @eworks/web dev" },
      "cwd": "${workspaceFolder}",
      "serverReadyAction": {
        "pattern": "- Local:\\s+(https?://\\S+)",
        "uriFormat": "%s",
        "action": "debugWithChrome",
        "webRoot": "${workspaceFolder}/apps/web"
      }
    },
    {
      "name": "Web: yalnız sunucu (8765)",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm --filter @eworks/web dev",
      "windows": { "command": "pnpm.cmd --filter @eworks/web dev" },
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Web: tarayıcı (8765)",
      "type": "chrome",
      "request": "launch",
      "url": "http://127.0.0.1:8765",
      "webRoot": "${workspaceFolder}/apps/web"
    },
    {
      "name": "Birim testi: açık dosya (Vitest)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--project", "birim", "${fileBasename}"],
      "cwd": "${workspaceFolder}",
      "autoAttachChildProcesses": true,
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"]
    },
    {
      "name": "Betik: açık dosya (Node 24)",
      "type": "node",
      "request": "launch",
      "program": "${file}",
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Docker: işçiye bağlan (9230)",
      "type": "node",
      "request": "attach",
      "address": "127.0.0.1",
      "port": 9230,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "restart": true,
      "skipFiles": ["<node_internals>/**", "/app/node_modules/**"]
    },
    {
      "name": "Docker: entegrasyona bağlan (Python 5678)",
      "type": "debugpy",
      "request": "attach",
      "connect": { "host": "127.0.0.1", "port": 5678 },
      "pathMappings": [{ "localRoot": "${workspaceFolder}/services/integration", "remoteRoot": "/app" }],
      "justMyCode": true
    }
  ]
}
```

## 8. Testler: hangisi, ne zaman

| Komut | Ne sınar | Süre | Ne zaman |
|---|---|---|---|
| `pnpm test` | Birim testleri (TypeScript; veritabanısız) | saniyeler | Her değişiklikte |
| `pnpm verify` | Birim + kapsam eşiği + tip + mimari kurallar + yetki anahtarları + belgeler | ~1 dk | Commit'ten önce, **her zaman** |
| `node tools/deploy/yigin.mjs test` | Gerçek veritabanı, kuyruk, depoyla entegrasyon testleri; veritabanı güvenlik testleri (pgTAP); Python entegrasyonu (sahte GİB'e karşı gerçek tarayıcı) | ~5 dk | Veritabanı, işçi, entegrasyon değiştiyse |
| `node tools/deploy/yigin.mjs e2e` | Arayüz kabul testleri, dört ekran boyutunda (telefon, tablet, dizüstü, geniş) + erişilebilirlik | ~5 dk | Arayüz değiştiyse |

Testlerden biri kırmızıysa iş bitmemiştir; testi gevşetmek ya da atlamak yasaktır ([kurallar](../ai/kurallar.md)).

## 9. Durdur ve temizle

```bash
node tools/deploy/yigin.mjs down          # durdurur; veriler kalır
node tools/deploy/yigin.mjs down --sil    # durdurur ve tüm verileri siler (temiz başlangıç)
```

Docker yer kaplıyorsa: Docker Desktop → Troubleshoot → Clean / Purge data, ya da `docker system prune` (kullanılmayan imaj ve önbellekleri siler).

## 10. Dallar ve iş bitirme

İşe başlarken kişisel dal aç (`<adın>/<kısa-iş>`), bitince commitle, ortak dala birleştirmeyi ajan [birleştirme betiğiyle](../../tools/ajan/birlestir.mjs) yapar; `push` her zaman senin onayınla. Ayrıntı: [kurallar, "Dal, commit, birleştirme"](../ai/kurallar.md#dal-commit-birleştirme).

## 11. Sunucuya (VPS) kurulum

Canlı ortam: [VPS kurulum rehberi](vps-kurulum.md) (`uretim` kipini kendi bilgisayarında denemek: [Yığın kipleri §5](kipler.md#5-uretim)) — sunucu hazırlığı, alan adı ve otomatik HTTPS, üretim kurulumu (`node tools/deploy/yigin.mjs uretim`), ilk ofis yöneticisi, güncelleme, yedek.

## 12. Sorun giderme

| Belirti | Neden | Çözüm |
|---|---|---|
| `Filename too long` (clone, pull, checkout) | Windows 260 karakter yol sınırı | `git config --global core.longpaths true`, sonra `git checkout -f HEAD` |
| `Cannot find matching keyid` (corepack / pnpm) | Node 20 ile gelen eski corepack, npm'in yeni imza anahtarını tanımıyor | Node 24 kur; ya da `npm install -g corepack@latest`; geçici çözüm `npx pnpm@10.18.3 install` |
| `pnpm verify` Node sürümü / TypeScript hatası | Node 24'ten eski | Node 24 kur; ya da `sh tools/deploy/dogrula.sh` (aynı denetimler Node 24 container'ında) |
| `port is already allocated` | 8080 ya da geliştirme/hata ayıklama portları başka programda | `deploy/compose/.env`'de `WEB_PORT=8081` gibi değiştir; geliştirme portları `GELISTIRME_*_PORT`, hata ayıklama `HATA_AYIKLAMA_ISCI_PORT`, `HATA_AYIKLAMA_PYTHON_PORT` (launch.json'daki portu da aynı yap; bkz. [deploy/README.md](../../deploy/README.md)) |
| `pnpm.ps1 cannot be loaded … is not digitally signed` (PowerShell) | Makinenin PowerShell politikası `AllSigned`; npm/corepack'in `pnpm.ps1`'i imzasız | Komutu `pnpm.cmd` ile yaz (`pnpm.cmd --filter @eworks/web dev`) ya da Git Bash kullan. VS Code yapılandırmaları ve görevleri Windows'ta bunu kendiliğinden yapar. Politikayı gevşetmek gerekmez |
| `EADDRINUSE 127.0.0.1:8765` | 8765'te başka bir şey çalışıyor (ör. Eworks 2 pilot portalı) | Onu kapat ya da geçici olarak başka portta çalıştır: `pnpm --filter @eworks/web exec next dev -p 8766 -H 127.0.0.1` |
| VS Code: "Docker: … bağlan" bağlanamıyor | Yığın `debug` kipinde değil | `node tools/deploy/yigin.mjs debug`; Python için "Python Debugger" eklentisi kurulu olmalı |
| VS Code: kesme noktası gri kalıyor (bağlanmadı) | Container eski kodla çalışıyor ya da dosya Docker'daki web'e ait | `yigin.mjs debug` ile yeniden derle; web için §6 |
| Girişte "E-posta ya da parola hatalı." | E-posta `demo@eworks.test` değil, parola eksik/fazla kopyalandı ya da demo hesabı henüz açılmadı | E-posta ve `DEMO_SIFRE` için §3 "Demo hesabı"; hesap yoksa `node tools/deploy/yigin.mjs gelistir` (ya da `up`) açar |
| Kurulumda `Kullanıcı var, parola farklı` | Demo hesabı açıldıktan sonra `.env`'deki `DEMO_SIFRE` değişti | Eski değeri geri koy ya da `node tools/deploy/yigin.mjs down --sil` (tüm veriler silinir), sonra `up` |
| `Kullanıcı açılamadı (500)` | Veritabanı yeniden oluşunca kimlik servisi eski bağlantıda kaldı (`yigin.mjs` bunu algılayıp kimlik servisini kendisi yeniden başlatır) | `docker restart eworks-auth-1`, sonra komutu tekrar çalıştır |
| Giriş sayfası açılmıyor, container'lar yeniden başlıyor | Docker'a ayrılan bellek az | Docker Desktop → Resources → en az 6 GB |
| `pnpm verify`: "üretilen blokların dışına elle içerik eklenmiş" | `AGENTS.md`, `MEMORY.md` gibi üretilen bir dosya elle değişti | `node tools/ajan/senkron.mjs --yaz`; kuralı `CLAUDE.md` ya da `docs/ai`'ye yaz |
| Ortak dala commit reddedildi | Kural: doğrudan commit yok | `git switch -c <adın>/<kısa-iş>` ile kişisel dal aç, yeniden commitle |

Çözemediğin sorunu ekip hafızasına ya da `docs/ai/durum.md` açık konularına yazdır (ajana "bunu hafızaya yaz" demen yeter).

## 13. Sonra ne okumalı

[Genel bakış ve okuma sırası](../00-genel-bakis.md#okuma-sırası-junior) — mimari, bağlamlar ve kuralları hangi sırayla okuyacağın.

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **Başlangıç rehberi**
<!-- /gezinti -->
