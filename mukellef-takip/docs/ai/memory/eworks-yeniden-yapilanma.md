---
name: eworks-yeniden-yapilanma
description: "[mert/eworks] Depo yeniden yapılanmasını (tüm klasörler eski/, Eworks SaaS kökte) uygulamak için gereken her şey: belge yerleri, adımlar, git'in taşımadığı yerel dosyalar, kırılan yollar"
metadata:
  type: project
---

Klasör: depo kökü (Eworks SaaS yeniden yapılanması)

2026-10-24'te Hakan kararı (D28/K-35):
- Ortakcalisma'daki **tüm klasörler** (`mukellef-takip`, `mert`, `hkazaz`, `hakan`, `yunus`) ve kök `CLAUDE.md`/`AGENTS.md`/`README.md` `eski/` altına taşınır.
- Eworks SaaS monoreposu **depo kökünde** kurulur.
- Hafıza, kanca ve ekip hafızası yolları güncellenir.

**Durum: yalnız plan. Taşıma, Hakan'ın açık onayıyla ayrı adımda yapılır.**

Uygulamak için okunacaklar (hepsi `hkazaz/eworks/05-hedef-mimari/`):
- `08-depo-yeniden-yapilanmasi.md`:
  - §1 hedef ağaç;
  - §2 satış portalı (`apps/sales`);
  - §3 yol tablosu;
  - **§3a git'in taşımadığı yerel dosyalar**;
  - §4 adımlar.
- `06-kaynak-kod-yapisi-ddd-tdd.md` §3: yeni kök iskeleti.
- `09-yapay-zeka-ajan-baglami.md`: Claude↔Codex senkronu ve §7 geçiş.
- `07-veri-saklama-ve-sharding.md`: `supabase/migrations/control` ve `tenant` ayrımı.

Kodda veya planda kolay gözden kaçan noktalar (24.10 denetimi):
- `git mv` gitignore'daki dosyaları taşımaz. Her makinede pull'dan sonra yerel taşıma betiği (`tools/ajan/eski-yerel-tasi.mjs`) gerekir. Taşınmayanlar:
  - `.claude/settings.local.json` dosyaları;
  - `hkazaz/docker/mert/.env` ve `supabase/{functions,migrations}` (Docker denemesi, izlenmiyor);
  - `mukellef-takip/infra/docker/secrets/`;
  - `mert/eworks` altındaki `jobs/` (kişisel veri: silinmeli) ve `.ocr-venv`;
  - derleme çıktıları ve `node_modules` (silinip yeniden kurulur).
- Kök `.claude/settings.local.json` içindeki `autoMemoryDirectory` `mukellef-takip/docs/ai/memory`'yi gösteriyor. Bugünkü `session-start.mjs` farklı değeri **yalnız uyarır**, yeni sürüm eski yolu tanıyıp düzeltmeli.
- `npm run hooks:install` `core.hooksPath=mukellef-takip/.githooks` yazar (depo köküne göreli). Taşınınca kırılır; yeni değer `tools/git-hooks`.
- `MEMORY.md merge=union` kuralı `mukellef-takip/.gitattributes`'ta. Kökte yeni `.gitattributes` gerekir.
- `.github/workflows/mukellef-takip.yml` `mukellef-takip/**` yollarına bağlı. Mükellef Takip'in `eski/` sonrası durumu açık konudur ([[eworks-acik-konular]]).
- `mukellef-takip/.claude/settings.json` kancaları `CLAUDE_PROJECT_DIR`'e görelidir. `eski/mukellef-takip` ayrı proje olarak açılırsa çalışır.
- Ekip hafızası taşınırken:
  - `eworks-*` kayıtları ile genel ekip kayıtları (`ekip-hafizasi-duzeni`, `claude-baglami-depoda`, `ajan-senkron-betikleri`) yeni yollara uyarlanıp kök `docs/ai/memory/`'ye alınır;
  - Mükellef Takip'e özgü kayıtlar `eski/mukellef-takip/docs/ai/memory/`'de kalır;
  - `hkazaz/eworks` belgeleri `docs/hedef-mimari/` ve `docs/arsiv/mevcut-durum/` altına gider.

**Why:** Taşıma tek seferlik ve geri alması zor bir iştir, birden çok ekip üyesinin yerel ortamını etkiler. Bu bilgiler başka bir oturumda eksiksiz uygulanabilsin diye burada toplandı (kullanıcı 2026-10-24'te teyit istedi).
**How to apply:** Yeniden yapılanma istendiğinde önce kullanıcıdan taşıma onayı ve tarihini al. Ekip duyurusunu hatırlat. 08 §4 adımlarını ve §3a tablosunu uygula. Sonra `check-memory`, `senkron --denetle`, bağlantı ve mermaid denetimlerini koş. Kararlar: [[eworks-hedef-mimari]]; çalışma biçimi: [[eworks-calisma-bicimi]].
