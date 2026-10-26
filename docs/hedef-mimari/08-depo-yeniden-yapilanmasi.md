<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [01 Hedef mimari](01-cok-kiracili-hedef-mimari.md) › **08 Depo yeniden yapılanması**
<!-- /gezinti -->

# 5.8 Depo yeniden yapılanması — `eski/` ve yeni kök

> Önce: [5.6 Kaynak kod yapısı](06-kaynak-kod-yapisi-ddd-tdd.md)
> Kararlar (24.10.2026, Hakan): **D28** Ortakcalisma'daki **tüm klasörler** (mukellef-takip dahil) `eski/` altına taşınır. Yeni Eworks SaaS yapısı **depo kökünde** kurulur. Taşınan hafıza dosyaları, kancalar ve ekip hafızası yolları güncellenir · **D27** satış portalı yeni yapının içindedir · **D29** veri taşıma yoktur.
> **Durum: uygulandı (24.10.2026, `yeniden-yapilanma` dalı; [ADR 0001](../adr/0001-depo-yeniden-yapilanmasi.md)).** Bu belgedeki "bugün" sütunları taşıma öncesini anlatır. Uygulamada plandan farklar §6'da.

## 1. Hedef görünüm

```
Ortakcalisma/                        ← depo kökü = Eworks SaaS monoreposu
├─ README.md                         ← proje haritası (5.6 §5)
├─ CLAUDE.md · AGENTS.md             ← Eworks proje bağlamı (yeni)
├─ .claude/settings.json             ← kancalar → tools/claude/* (yeni yollar)
├─ .github/workflows/eworks.yml      ← yeni CI
├─ .vscode/extensions.json
├─ docs/
│  ├─ 00-genel-bakis.md
│  ├─ hedef-mimari/                  ← bugünkü hkazaz/eworks/05-hedef-mimari/* (01–08)
│  ├─ baglamlar/<context>.md
│  ├─ adr/                           ← K-NN kararları ADR biçiminde
│  ├─ arsiv/mevcut-durum/            ← bugünkü hkazaz/eworks/00–04 (eski kodun analizi)
│  ├─ ozellik-durumu.md              ← CI üretir
│  └─ ai/ (+ memory/)                ← YENİ ekip hafızası dizini
├─ contracts/ · packages/ · apps/ · services/ · supabase/ · deploy/ · tools/   (5.6 §3)
│  └─ apps/: web (müşavir/mükellef portalı), sales (satış portalı), worker
└─ eski/                             ← dokunulmayan arşiv / referans
   ├─ README.md                      ← "bu klasör nedir, neyi nerede bulursun"
   ├─ CLAUDE.md · AGENTS.md          ← eski kök bağlam dosyaları
   ├─ mukellef-takip/                ← kendi CLAUDE.md, docs/ai, memory, .claude ile
   ├─ mert/eworks/                   ← entegrasyon-1-tarayici (yeniden yapılandırılan uygulamanın kaynağı)
   ├─ hkazaz/  ·  hakan/  ·  yunus/
```

## 2. Satış portalı (D27)

`mukellef-takip/satis` deseni (ADR 0009) yeni yapıda aynen uygulanır:

| Konu | Yeni yapı |
|---|---|
| Uygulama | `apps/sales` (Next.js, ayrı imaj, turuncu tema) + `packages/contexts/sales` |
| Kullanıcılar | `SalesUser` müşavir/mükellef kullanıcılarından ayrı tablodadır, iki adımlı doğrulama zorunludur |
| Ne açar | **Ofis, müşavir ve mükellef hesapları** satış portalından açılır. Kendi kendine kayıt kapalıdır (`DISABLE_SIGNUP=true`). Ofis açılırken kiracı shard'ı atanır (5.7) |
| Mükellef onayı (D18) | Satış sözleşmesiyle alınır. Satış portalı mükellef için `credential_consents` kaydını **sözleşme referansıyla** (`given_by = sales_contract`, belge kimliği) oluşturur. Kurum bazında kapsam sözleşmeden işlenir |
| Veri sınırı | Satış yalnız kontrol düzlemindeki hesap tablolarına ve shard'larda hesap açma use-case'ine erişir. **Mükellef iş verisini (beyanname, SGK, belge) göremez.** Veritabanı rolüyle zorlanır (`sales_user`) |
| Denetim | Ofisi etkileyen her satış işlemi iki yere yazılır: satış kaydı ve ofisin kendi denetim kaydı |

## 3. Hafıza, kanca ve yol değişiklikleri

> Claude ↔ Codex karşılıklı senkronun hedef tasarımı (tek kaynak, üretilen `AGENTS.md`, git kancaları): [5.9](09-yapay-zeka-ajan-baglami.md). Aşağıdaki tablo taşımanın yol değişiklikleridir.

| Bugün | Taşımadan sonra | İşlem |
|---|---|---|
| Ekip hafızası `mukellef-takip/docs/ai/memory/` | **`docs/ai/memory/`** (kök) | Yeni dizin. Eworks kayıtları (`eworks-*`) ve genel ekip düzeni kayıtları (`ekip-hafizasi-duzeni`, `claude-baglami-depoda`, `ajan-senkron-betikleri`) yeni yollara göre **uyarlanarak** kopyalanır. Mükellef Takip'e özgü kayıtlar `eski/hakan/mukellef-takip/docs/ai/memory/`'de kalır |
| Kök `.claude/settings.json` → `mukellef-takip/tools/claude/*.mjs` | → `tools/claude/*.mjs` (kök) | Betikler kopyalanır ve uyarlanır: bağlam yolları, `MEMORY.md` yolu, `memory:check` |
| `autoMemoryDirectory` (geliştiricinin `.claude/settings.local.json`) eski yolu gösteriyor | Yeni yol | `session-start.mjs` değiştirilir: değer **bilinen eski yol** ise yenisiyle değiştirilir (bugün yalnız uyarı veriyor), başka bir değerse uyarı verilir |
| `mukellef-takip/tools/ajan/{ortak,claude,codex}.ps1` | `tools/ajan/` (kök) | `$BaglamYollari` yeni yapıya göre: `CLAUDE.md`, `AGENTS.md`, `docs/ai`, `docs/adr`, `docs/baglamlar`, `docs/hedef-mimari` |
| `hkazaz/eworks/CLAUDE.md` + `ai/` | Kök `CLAUDE.md` + `docs/ai/*.md` | Hedef mimariye göre yeniden yazılır. Mevcut-durum bağlamı `docs/arsiv/` altına |
| `.github/workflows/mukellef-takip.yml` | `eski/` yoluna göre yol filtresi **veya** devre dışı | Karar: §5 |
| `eski/hakan/mukellef-takip/.claude/settings.json` | Değişmez | `CLAUDE_PROJECT_DIR`'e göre görelidir. `eski/hakan/mukellef-takip` ayrı proje olarak açılırsa kendi kancaları çalışır |
| `.vscode/extensions.json` | Kökte kalır | — |

## 3a. Git'in taşımadığı ve yol bağımlı şeyler (24.10 denetimi)

`git mv` yalnız izlenen dosyaları taşır. Aşağıdakiler her geliştiricinin makinesinde **yerinde kalır** veya eski yolu gösterir. Bu yüzden taşıma, git commit'inin yanında **makine başına bir yerel taşıma betiği** (`tools/ajan/eski-yerel-tasi.mjs`) ister. Her geliştirici pull'dan sonra bu betiği bir kez çalıştırır.

| Öğe | Bugünkü yer | Sorun | Yapılacak |
|---|---|---|---|
| Kök `.claude/settings.local.json` | kök | `autoMemoryDirectory` = `mukellef-takip/docs/ai/memory` (mutlak yol) + kişisel izinler | Kökte kalır; `autoMemoryDirectory` yeni `docs/ai/memory`'ye çevrilir (yeni `session-start.mjs` eski yolu tanıyıp düzeltir) |
| `mukellef-takip/.claude/settings.local.json` | gitignore | Taşınmaz | Yerel betik `eski/hakan/mukellef-takip/.claude/` altına taşır |
| `hkazaz/docker/mert/.env`, `supabase/{functions,migrations,.temp,.branches}` | gitignore (yalnız Hakan'da) | Taşınmaz; Docker denemesi bunlara bağlı | Yerel betik `eski/hkazaz/...` altına taşır |
| `mukellef-takip/infra/docker/secrets/` | gitignore | Taşınmaz; Docker sırları | Yerel betik taşır |
| `node_modules/`, `dist/`, `.next/`, `coverage/`, `src/generated/` (Prisma), `*.tsbuildinfo`, playwright raporları, `.mypy_cache/` | gitignore | Taşınmaz, eski yerde çöp kalır | Taşınmaz; silinir, gerekirse `eski/` altında yeniden kurulur (`npm ci`, `prisma generate`) |
| `mert/eworks/.../jobs/`, `.ocr-venv/`, `.env` (varsa) | gitignore | Taşınmaz; kişisel veri içerebilir | Yerel betik taşır; `jobs/` kişisel veri içerdiği için taşımak yerine **silinmesi** önerilir |
| `core.hooksPath` (`npm run hooks:install` çalıştıranlarda) | git yerel ayarı = `mukellef-takip/.githooks` | Depo köküne göreli; taşınınca kanca bulunamaz | Yeni değer `tools/git-hooks` (5.9) |
| `mukellef-takip/.gitattributes` (`docs/ai/memory/MEMORY.md merge=union`, LF kuralları) | `mukellef-takip/` | Yeni kök hafızası için geçerli değil | Kök `.gitattributes` yazılır (aynı kurallar + yeni yollar) |
| `.github/workflows/mukellef-takip.yml` | kök | `paths: mukellef-takip/**`, `working-directory: mukellef-takip` | §5 kararına göre `eski/hakan/mukellef-takip` yollarına çevrilir veya kapatılır; yeni `eworks.yml` |
| Kök `CLAUDE.md`, `AGENTS.md`, `README.md` | kök | Klasör tablosu ve `mukellef-takip/...` yolları | `eski/` altına taşınır; yenileri yazılır |
| Kök `.claude/settings.json` kancaları | `mukellef-takip/tools/claude/*.mjs` | Yol kırılır | `tools/claude/*.mjs` |
| `.claude/skills/{hafiza,oryantasyon}` | `mukellef-takip/.claude/skills` | Kökte beceri yok | `docs/ai/beceriler/` kaynak → üretilir (5.9) |
| Ekip hafızası rehberi | `mukellef-takip/docs/05-gelistirici-rehberi/05-claude-code.md` | Yeni yapıyı anlatmıyor | `docs/gelistirici-rehberi/claude-codex.md` yeniden yazılır |
| `npm run memory:check` | `mukellef-takip/package.json` | Kökte yok | Kök `package.json`'da `memory:check` + `ajan:senkron` |
| Compose imaj adları `mukellef-takip/*:local` | `eski/hakan/mukellef-takip/infra/docker` | Yol değil, yalnız ad | Değişmez |

## 4. Uygulama adımları (onaydan sonra)

1. Ekibe (Ferhat, Hakan Göktaş, Mert, Yunus) duyuru: herkes açık işini commit/push eder, belirlenen saatte depo dondurulur. Pull sonrası herkesin yerel taşıma betiğini çalıştıracağı bildirilir (§3a).
2. Dal: `yeniden-yapilanma`.
3. `git mv` ile tüm üst klasörler ve kök `CLAUDE.md`, `AGENTS.md`, `README.md` `eski/` altına taşınır. Git geçmişi korunur.
4. Yeni kök iskeleti (5.6 §3): README, CLAUDE.md, AGENTS.md, `docs/`, boş bağlam paketleri, `feature-registry` (tüm ekranlar kırmızı), `tools/arch`, `tools/features`.
5. Hafıza ve kancalar (§3) ile Claude ↔ Codex senkronu ([5.9 §7](09-yapay-zeka-ajan-baglami.md#7-geçiş-58deki-taşıma-adımlarına-eklenir)). `node tools/claude/check-memory.mjs` ve `node tools/ajan/senkron.mjs --denetle` yeşil olmalı.
6. `hkazaz/eworks` belgeleri `docs/hedef-mimari/` ve `docs/arsiv/mevcut-durum/` altına taşınır, iç bağlantılar düzeltilir.
7. CI: yeni `eworks.yml`, eski iş akışı için karar uygulanır.
8. Doğrulama:
   - yeni bir Claude Code oturumunda kancanın yeni hafızayı yüklemesi;
   - `autoMemoryDirectory`'nin güncellenmesi;
   - bağlantı denetimi;
   - mermaid çizimi;
   - `pnpm arch`/`pnpm test` iskelet üzerinde yeşil.
9. PR ve ekip onayı, ardından birleştirme. Ekip üyeleri `git pull` sonrası yeni oturum açar.

## 5. Kararlar (önceden bekleyenler)

- **Mükellef Takip arşivdir** (D32, K-39): `.github/workflows/mukellef-takip.yml` yalnız elle tetiklenir (`workflow_dispatch`), çalışma dizini `eski/hakan/mukellef-takip`; eski pre-push kancası etkisizdir.
- **Ekip duyurusu** taşımadan önce yapıldı; taşıma 24.10.2026'da uygulandı.

## 6. Uygulamada plandan farklar (24.10)

- Eski kök `README.md`, §1'deki yeni `eski/README.md` ile aynı yolu istediği için `eski/README-eski-kok.md` adını aldı.
- Arşivdeki Eworks bağlam dosyaları `docs/arsiv/mevcut-durum/CLAUDE.eski.md` / `AGENTS.eski.md` oldu; `CLAUDE.md` adıyla kalsalar o dizinde etkin ajan bağlamı sayılırlardı.
- Karar kaydı (`02-mimari/05-mimari-kararlar.md`) arşive değil `docs/adr/karar-kaydi.md`'ye taşındı (yaşayan kayıt); §1'deki "`hedef-mimari/` ← 01–08" 09'u da kapsar.
- `git mv` Windows'ta klasörü diskte bütün olarak yeniden adlandırdığı için taşımayı yapan makinede yoksayılan dosyalar da taşındı. Diğer makinelerde §3a geçerlidir: `node tools/ajan/eski-yerel-tasi.mjs --uygula`.
- `AGENTS.md` hafıza bloğu son 14 günün değişikliklerini değil `git log` komutunu içerir ([5.9 §4](09-yapay-zeka-ajan-baglami.md#4-senkronmjs-ne-yapar)).
- Skill kaynakları `docs/ai/beceriler/`, karar sayısı K-01…K-39, bağlam sayısı 12 (`sales` dahil).

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [01 Hedef mimari](01-cok-kiracili-hedef-mimari.md) › **08 Depo yeniden yapılanması**
<!-- /gezinti -->
