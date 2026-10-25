---
name: eworks-yeniden-yapilanma
description: "Depo yeniden yapılanması (D28) 2026-10-24'te uygulandı — eski/ arşivi, her makinede eski-yerel-tasi betiği, git mv'nin Windows'ta yoksayılan dosyaları da taşıması, açık dallar, eski yollar"
metadata:
  node_type: memory
  type: project
  originSessionId: a63a5043-0c86-4b4c-b487-9b76c14082ac
  modified: 2026-10-25T20:55:54.604Z
---

2026-10-24'te Hakan'ın onayıyla (D28/K-35, ADR 0001) `yeniden-yapilanma` dalında uygulandı: `mukellef-takip`, `mert`, `hkazaz`, `hakan`, `yunus` ve eski kök `CLAUDE.md`/`AGENTS.md` `eski/` altına `git mv` ile taşındı; Eworks SaaS iskeleti kökte. Mükellef Takip **arşiv** (D32/K-39). Ekip duyurusu taşımadan önce yapıldı.

Kodda/belgede kolay görünmeyen noktalar:
- **Her makinede pull'dan sonra bir kez** `node tools/ajan/eski-yerel-tasi.mjs --uygula`: gitignore'daki dosyalar (`.env`, `infra/docker/secrets/`, `.claude/settings.local.json`, `hkazaz/docker/mert/supabase/*`) eski yerde kalır. Betik bunları `eski/` altına taşır, derleme çıktılarını siler, eski `autoMemoryDirectory` ve `core.hooksPath`'i düzeltir. `jobs/` (kişisel veri) yalnız `--jobs-sil` ile silinir.
- Hakan'ın makinesinde `git mv` klasörleri diskte bütün olarak yeniden adlandırdığı için yoksayılan dosyalar da `eski/` altına gitti (betik yalnız `.mypy_cache` ve hafıza ayarını buldu). Diğer makinelerde `git pull` bunu yapmaz.
- Eski kök `README.md`, `eski/README.md` ile çakışmasın diye `eski/README-eski-kok.md` oldu (08 §1'deki ağaç ikisini de `eski/README.md` olarak gösteriyordu).
- Arşivdeki Eworks bağlam dosyaları `docs/arsiv/mevcut-durum/{CLAUDE,AGENTS}.eski.md` adını aldı; `CLAUDE.md` adıyla kalsalar Claude o dizinde çalışırken onları etkin bağlam sayardı.
- Karar kaydı `docs/adr/karar-kaydi.md`'ye taşındı (eski yeri `hkazaz/eworks/02-mimari/05-mimari-kararlar.md`).
- **2026-10-25:** Mükellef Takip `eski/mukellef-takip` → `eski/hakan/mukellef-takip` taşındı (Hakan'ın isteği; arşiv durumu değişmedi). Betik iki eski yeri de (`mukellef-takip/`, `eski/mukellef-takip/`) tanır ve yeni yere taşır; `node_modules` silinir, yeni yerinde `npm install` gerekir. npm workspace bağlantıları (`node_modules/{api,web,satis-api,satis-web}` junction) mutlak yol tutar; klasör taşınınca kırılır. Hakan'ın makinesinde yeni yere yeniden bağlandı.
- Taşımadan önce açılmış dallar (`origin/feature/eworks-*`, `hakan/*`) eski yollardadır; birleştirmede çakışırsa dal sahibi `eski/` yoluna taşır.

**Why:** Taşıma her ekip üyesinin yerel ortamını etkiler ve tek seferliktir; pull sonrası yapılacaklar ve tuzaklar başka oturumlarda da bilinmeli.
**How to apply:** Bir ekip üyesi "ekip hafızası yok", "kanca bulunamadı", "`.env` kayboldu" derse önce `eski-yerel-tasi.mjs` kuru çalıştırmasını öner. Açık dal birleştirmelerinde yol çakışması beklenir. Kararlar: [[eworks-hedef-mimari]]; çalışma biçimi: [[eworks-calisma-bicimi]]; senkron: [[ajan-senkron-betikleri]].
