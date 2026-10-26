# Başlangıç: kur, çalıştır, değiştir, test et

Bu rehber projeye yeni katılan ve yazılım geliştirmede deneyimi az olan ekip üyeleri içindir. Sonunda uygulamayı kendi bilgisayarında çalıştırmış, demo hesabıyla girmiş, kodda bir değişikliği anında görmüş ve testleri koşmuş olursun. Komutlar Windows'ta **Git Bash**'te yazılır (PowerShell'de de çalışır; fark varsa belirtilmiştir).

Kodu genelde Claude Code ya da Codex ile değiştirirsin: [claude-codex.md](claude-codex.md#ajana-iş-verdiğinde-ne-olur-gelistir). Bu rehber, ajan çalışırken neyin olup bittiğini anlaman ve sonucu kendi gözünle doğrulaman içindir. Bilmediğin terimler: [terimler.md](terimler.md).

## 1. Gerekenler

| Araç | Neden | Not |
|---|---|---|
| **Git** | Kodu almak ve göndermek | Windows'ta Git for Windows (Git Bash ile gelir) |
| **Docker Desktop** | Veritabanı, kimlik, kuyruk, depo ve uygulamanın kendisi container'da çalışır | WSL 2 altyapısıyla. Ayarlar → Resources: en az **6 GB bellek**, **25 GB boş disk** (yığın boştayken ~1 GB bellek kullanır; tarayıcılı testlerde artar; imajlar ~12 GB) |
| **Node.js 24** | Komut betikleri, web uygulaması, testler | Sürüm `.nvmrc`'de. Windows'ta `winget install OpenJS.NodeJS` ya da nvm-windows. **Node 20 ile `corepack` pnpm'i indiremez** (§8) |
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
corepack enable                     # PowerShell'de yönetici ister; olmazsa her komutun başına "corepack " yaz: corepack pnpm install
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
3. Veritabanı şemasını kurar (migration), demo ofisini ve kullanıcısını açar.
4. Uygulamayı başlatır: web, işçi, kurum entegrasyonu ve **sahte GİB** (gerçek GİB'e hiçbir istek gitmez).

Bitince `✔ Yığın ayakta: http://localhost:8080` yazar. Tarayıcıda aç ve gir:

- E-posta: `demo@eworks.test`
- Parola: `deploy/compose/.env` dosyasındaki `DEMO_SIFRE` değeri

Kırmızı çerçeveli ve "Geliştiriliyor" yazan bölümler henüz yapılmadı (bu bilinçli, D30). Firmalar → "GİB'den güncelle" gibi kurum işleri sahte GİB'le çalışır.

## 4. Kod değiştirirken: geliştirme döngüsü

Docker'daki web (8080) derlenmiş bir imajdır; kod değişikliğini görmek için imajın yeniden derlenmesi gerekir. Web arayüzünde ve BFF'te çalışırken bunun yerine web'i **Docker'sız** çalıştır; kaydettiğin değişiklik tarayıcıda anında görünür:

```bash
node tools/deploy/yigin.mjs gelistir        # yığın + altyapı portları yalnız bu bilgisayarda (127.0.0.1) + apps/web/.env.local
pnpm --filter @eworks/web dev               # → http://127.0.0.1:8765 (aynı demo hesabı)
```

- `gelistir`, `up`'ın yaptığı her şeyi yapar; ayrıca veritabanı, kimlik, Redis ve S3 portlarını **yalnız 127.0.0.1**'e açar (ağdaki başka bilgisayar erişemez) ve web'in bunlara bağlanacağı `apps/web/.env.local`'i yazar. Bu dosya sır içerir, git'e girmez.
- 8765, Eworks 2 pilot portalının (Mert) adresidir. Durdurmak için terminalde `Ctrl+C`.
- Docker'daki 8080 aynı veritabanını kullanır ama eski kodla çalışır; geliştirirken 8765'i kullan.
- Geliştirme kipi hatırlanır: sonraki `up`, `test`, `e2e` portları açık tutar. Kapatmak için `node tools/deploy/yigin.mjs up --gelistirme-kapat`.

Başka bir yerde değişiklik yaptıysan:

| Değişen | Görmek için |
|---|---|
| `apps/web`, `packages/*` (web'in kullandığı) | `pnpm --filter @eworks/web dev` açıksa kendiliğinden |
| `apps/worker`, `services/integration`, `supabase/migrations` | `node tools/deploy/yigin.mjs up` (imajlar ve şema yeniden kurulur) |
| Yalnız Python entegrasyonu (hızlı test) | [services/integration/README.md](../../services/integration/README.md) |

Kod değiştirmenin kuralları ve adımları (önce test, sonra kod): [gelistir becerisi](../ai/beceriler/gelistir.md), [TDD nedir](tdd-nedir.md).

## 5. Testler: hangisi, ne zaman

| Komut | Ne sınar | Süre | Ne zaman |
|---|---|---|---|
| `pnpm test` | Birim testleri (TypeScript; veritabanısız) | saniyeler | Her değişiklikte |
| `pnpm verify` | Birim + kapsam eşiği + tip + mimari kurallar + yetki anahtarları + belgeler | ~1 dk | Commit'ten önce, **her zaman** |
| `node tools/deploy/yigin.mjs test` | Gerçek veritabanı, kuyruk, depoyla entegrasyon testleri; veritabanı güvenlik testleri (pgTAP); Python entegrasyonu (sahte GİB'e karşı gerçek tarayıcı) | ~5 dk | Veritabanı, işçi, entegrasyon değiştiyse |
| `node tools/deploy/yigin.mjs e2e` | Arayüz kabul testleri, dört ekran boyutunda (telefon, tablet, dizüstü, geniş) + erişilebilirlik | ~5 dk | Arayüz değiştiyse |

Testlerden biri kırmızıysa iş bitmemiştir; testi gevşetmek ya da atlamak yasaktır ([kurallar](../ai/kurallar.md)).

## 6. Durdur ve temizle

```bash
node tools/deploy/yigin.mjs down          # durdurur; veriler kalır
node tools/deploy/yigin.mjs down --sil    # durdurur ve tüm verileri siler (temiz başlangıç)
```

Docker yer kaplıyorsa: Docker Desktop → Troubleshoot → Clean / Purge data, ya da `docker system prune` (kullanılmayan imaj ve önbellekleri siler).

## 7. Dallar ve iş bitirme

İşe başlarken kişisel dal aç (`<adın>/<kısa-iş>`), bitince commitle, ortak dala birleştirmeyi ajan [birleştirme betiğiyle](../../tools/ajan/birlestir.mjs) yapar; `push` her zaman senin onayınla. Ayrıntı: [kurallar, "Dal, commit, birleştirme"](../ai/kurallar.md#dal-commit-birleştirme).

## 8. Sorun giderme

| Belirti | Neden | Çözüm |
|---|---|---|
| `Filename too long` (clone, pull, checkout) | Windows 260 karakter yol sınırı | `git config --global core.longpaths true`, sonra `git checkout -f HEAD` |
| `Cannot find matching keyid` (corepack / pnpm) | Node 20 ile gelen eski corepack, npm'in yeni imza anahtarını tanımıyor | Node 24 kur; ya da `npm install -g corepack@latest`; geçici çözüm `npx pnpm@10.18.3 install` |
| `pnpm verify` Node sürümü / TypeScript hatası | Node 24'ten eski | Node 24 kur; ya da `sh tools/deploy/dogrula.sh` (aynı denetimler Node 24 container'ında) |
| `port is already allocated` | 8080 ya da geliştirme portları başka programda | `deploy/compose/.env`'de `WEB_PORT=8081` gibi değiştir; geliştirme portları için `GELISTIRME_DB_CONTROL_PORT` vb. (bkz. [deploy/README.md](../../deploy/README.md)) |
| `EADDRINUSE 127.0.0.1:8765` | 8765'te başka bir şey çalışıyor (ör. Eworks 2 pilot portalı) | Onu kapat ya da geçici olarak başka portta çalıştır: `pnpm --filter @eworks/web exec next dev -p 8766 -H 127.0.0.1` |
| `Kullanıcı açılamadı (500)` | Veritabanı yeniden oluşunca kimlik servisi eski bağlantıda kaldı (`yigin.mjs` bunu algılayıp kimlik servisini kendisi yeniden başlatır) | `docker restart eworks-auth-1`, sonra komutu tekrar çalıştır |
| Giriş sayfası açılmıyor, container'lar yeniden başlıyor | Docker'a ayrılan bellek az | Docker Desktop → Resources → en az 6 GB |
| `pnpm verify`: "üretilen blokların dışına elle içerik eklenmiş" | `AGENTS.md`, `MEMORY.md` gibi üretilen bir dosya elle değişti | `node tools/ajan/senkron.mjs --yaz`; kuralı `CLAUDE.md` ya da `docs/ai`'ye yaz |
| Ortak dala commit reddedildi | Kural: doğrudan commit yok | `git switch -c <adın>/<kısa-iş>` ile kişisel dal aç, yeniden commitle |

Çözemediğin sorunu ekip hafızasına ya da `docs/ai/durum.md` açık konularına yazdır (ajana "bunu hafızaya yaz" demen yeter).

## 9. Sonra ne okumalı

[Genel bakış ve okuma sırası](../00-genel-bakis.md#okuma-sırası-junior) — mimari, bağlamlar ve kuralları hangi sırayla okuyacağın.
