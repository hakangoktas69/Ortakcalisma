---
name: eworks-yeniden-yapilanma
description: "Depo yeniden yapılanması (D28) sürüyor: 2026-10-24 uygulandı, 2026-10-26 dev'e birleşti — ekibin pull sonrası yapacakları (longpaths, eski-yerel-tasi, kancalar, venv/npm yeniden kurulum, yeni oturum), açık dal sahiplerinin birleştirme adımları, tuzaklar"
metadata:
  node_type: memory
  type: project
  originSessionId: a63a5043-0c86-4b4c-b487-9b76c14082ac
  modified: 2026-10-26T00:00:00.000Z
---

Yeniden yapılanma (D28/K-35, ADR 0001) 2026-10-24'te `yeniden-yapilanma` dalında uygulandı: `mukellef-takip`, `mert`, `hkazaz`, `hakan`, `yunus` ve eski kök `CLAUDE.md`/`AGENTS.md` `eski/` altına `git mv` ile taşındı, Eworks SaaS kökte. 2026-10-26'da `dev`'e birleşti (Hakan'ın makinesinde yerel; push Hakan'ın onayıyla). Bundan sonra dal birleştirmeleri başlıyor: akış kişisel dal → `dev` → `main` ([[eworks-hedef-mimari]] D37).

## Pull sonrası, her makinede bir kez (sırayla)

1. **Önce yerel işi koru:** eski yollarda (`mert/`, `hakan/`, `mukellef-takip/` …) commitlenmemiş değişiklik varsa kendi dalında commitle. Ortak dala commit kancada reddedilir (kanca kuruluysa).
2. **Windows'ta uzun yol:** `git config core.longpaths true`. Yoksa pull/checkout `eski/hakan/mukellef-takip/apps/api/prisma/migrations/...` için "Filename too long" verip yarım kalır (2026-10-26'da Hakan'ın makinesinde görüldü).
3. `git fetch origin && git switch dev && git pull --ff-only`.
4. **Yerel dosyaları taşı:** `node tools/ajan/eski-yerel-tasi.mjs` (kuru), sonra `--uygula`. Git yalnız izlenen dosyaları taşır; `.env`, `infra/docker/secrets/`, `jobs/`, sanal ortamlar, `.claude/settings.local.json` eski yerde kalır. Betik bunları `eski/` altına taşır, derleme çıktılarını siler, eski `autoMemoryDirectory` ve `core.hooksPath`'i düzeltir. `jobs/` (kişisel veri) yalnız `--jobs-sil` ile silinir. `mert → eski/mert` eşlemesi `mert/eworks-arsiv` gibi sonradan açılan klasörleri de kapsar.
5. **Kancaları kur:** `corepack enable && pnpm install` (prepare → `node tools/ajan/senkron.mjs --kanca-kur`, `core.hooksPath = tools/git-hooks`). Eski `dev`'de bu kancalar yoktu; kurulmadan ortak dal koruması, senkron ve hafıza denetimi çalışmaz. Yerel Node 24 değilse komutlar `node:24` container'ında (`sh tools/deploy/dogrula.sh`).
6. **Taşınan bağımlılıkları yeniden kur:** Python sanal ortamları (`.venv`, `.ocr-venv`, `venv`) betikle bütün taşınır ama mutlak yol tuttukları için yeni yerinde bozuktur, yeniden oluşturulmalı. Mükellef Takip için `cd eski/hakan/mukellef-takip && npm install` (npm workspace junction'ları mutlak yol tutar).
7. **Yığın** gerekiyorsa: `node tools/deploy/yigin.mjs up` (sırlar yoksa `deploy/compose/.env` üretilir; varsa korunur). Yığını başka bir çalışma ağacından kurmak compose bağlamalarını o ağaca bağlar; asıl ağaçtan yeniden `up` ile düzelir.
8. **Yeni Claude/Codex oturumu aç:** bağlam (`CLAUDE.md`, `AGENTS.md`, `docs/ai`) ve ekip hafızası değişti; SessionStart kancası ekip hafızasını yükler. Kanca çalışmazsa `docs/ai/memory/MEMORY.md` elle okunur.

## Açık dal sahipleri (yeniden yapılanmadan önce açılmış dallar)

`origin/feature/eworks-*`, `hakan/*` ve Mert'in dalları eski yollardadır. Rebase değil merge: kişisel dalda `node tools/ajan/birlestir.mjs guncelle` (dev'i çeker), çakışmayı orada çöz, doğrulamaları yeniden koş, sonra `birlestir.mjs dev --mesaj "…"`. Beklenen çakışma türü **konum** ("file location", "rename/rename"): dosya eski yolda eklenmiş/yeniden adlandırılmış, bu tarafta `eski/` altına taşınmış. 2026-10-26 ilk birleşiminde 912 dosyanın hepsi bu türdendi, içerik çatışması yoktu. Çözüm: dalın son ağacını aynı göreli yolla `eski/` altına koy (ör. `git read-tree --prefix=eski/mert/eworks/ <dal>:mert/eworks`), önce bu tarafta taşınan dosyalarda içerik değişikliği olmadığını doğrula (`git diff --stat <merge-base>:mert/eworks HEAD:eski/mert/eworks` boş). Önizleme dosyaya dokunmadan: `git merge-tree --write-tree --name-only <dal> origin/dev`.

**Mert'e özel:** 23.10 işi (`entegrasyon-2-servis`, e-Defter hazırlığı, ilk sürüm `eworks-arsiv`) artık `eski/mert/eworks` ve `eski/mert/eworks-arsiv` altında, içerik kaybı yok. `eski/` altında yeni geliştirme yapılmaz; hangi kısımların yeni yapıya taşınacağı açık konu ([[eworks-acik-konular]] 13). Mert'in belgelerindeki `feature/…` dal adı ile D37'deki `<ad>/<kısa-iş>` uyumu da açık (14).

## Tuzaklar ve geçmiş

- Hakan'ın makinesinde `git mv` klasörleri diskte bütün olarak yeniden adlandırdığı için yoksayılan dosyalar da `eski/` altına gitti. Diğer makinelerde `git pull` bunu yapmaz; 4. adım şart.
- Aynı çalışma ağacında başka bir ajan oturumunun commitlenmemiş işi varsa birleşimi ayrı `git worktree`'de yap ([[paralel-oturumlar]]). Worktree `.git` dosyası container'da çözülmez: `dogrula.sh` için geçici `git clone` kullan; worktree Windows'ta CRLF ile açılır.
- Eski kök `README.md` → `eski/README-eski-kok.md`; arşiv bağlam dosyaları `docs/arsiv/mevcut-durum/{CLAUDE,AGENTS}.eski.md` (`CLAUDE.md` adıyla kalsalar etkin bağlam sayılırdı). Karar kaydı `docs/adr/karar-kaydi.md`.
- 2026-10-25: Mükellef Takip `eski/mukellef-takip` → `eski/hakan/mukellef-takip`; betik iki eski yeri de tanır.

**Why:** Taşıma her ekip üyesinin yerel ortamını ve açık dallarını etkiler; birleştirmeler başlarken pull sonrası adımlar ve tuzaklar tek yerde bilinmeli (Hakan'ın isteği, 2026-10-26).
**How to apply:** Ekip üyesi pull ettiğini, dal birleştireceğini ya da "ekip hafızası yok", "kanca bulunamadı", "`.env` kayboldu", "Filename too long", "venv çalışmıyor" dediğinde bu sırayı uygulat. Çalışma biçimi: [[eworks-calisma-bicimi]]; senkron: [[ajan-senkron-betikleri]].
