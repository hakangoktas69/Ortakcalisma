---
name: eworks-yeniden-yapilanma
description: Depo yeniden yapılanması (D28) 2026-10-24'te uygulandı — eski/ arşivi, her makinede eski-yerel-tasi betiği, git mv'nin Windows'ta yoksayılan dosyaları da taşıması, açık dallar, eski yollar
metadata:
  type: project
---

2026-10-24'te Hakan'ın onayıyla (D28/K-35, ADR 0001) `yeniden-yapilanma` dalında uygulandı: `mukellef-takip`, `mert`, `hkazaz`, `hakan`, `yunus` ve eski kök `CLAUDE.md`/`AGENTS.md` `eski/` altına `git mv` ile taşındı; Eworks SaaS iskeleti kökte. Mükellef Takip **arşiv** (D32/K-39). Ekip duyurusu taşımadan önce yapıldı.

Kodda/belgede kolay görünmeyen noktalar:
- **Her makinede pull'dan sonra bir kez** `node tools/ajan/eski-yerel-tasi.mjs --uygula`: gitignore'daki dosyalar (`.env`, `infra/docker/secrets/`, `.claude/settings.local.json`, `hkazaz/docker/mert/supabase/*`) eski yerde kalır. Betik bunları `eski/` altına taşır, derleme çıktılarını siler, eski `autoMemoryDirectory` ve `core.hooksPath`'i düzeltir. `jobs/` (kişisel veri) yalnız `--jobs-sil` ile silinir.
- Hakan'ın makinesinde `git mv` klasörleri diskte bütün olarak yeniden adlandırdığı için yoksayılan dosyalar da `eski/` altına gitti (betik yalnız `.mypy_cache` ve hafıza ayarını buldu). Diğer makinelerde `git pull` bunu yapmaz.
- Eski kök `README.md`, `eski/README.md` ile çakışmasın diye `eski/README-eski-kok.md` oldu (08 §1'deki ağaç ikisini de `eski/README.md` olarak gösteriyordu).
- Arşivdeki Eworks bağlam dosyaları `docs/arsiv/mevcut-durum/{CLAUDE,AGENTS}.eski.md` adını aldı; `CLAUDE.md` adıyla kalsalar Claude o dizinde çalışırken onları etkin bağlam sayardı.
- Karar kaydı `docs/adr/karar-kaydi.md`'ye taşındı (eski yeri `hkazaz/eworks/02-mimari/05-mimari-kararlar.md`).
- `eski/mukellef-takip/node_modules` içindeki workspace bağlantıları (junction) eski mutlak yolu gösterir; arşiv olduğu için yeniden kurulmadı.
- Taşımadan önce açılmış dallar (`origin/feature/eworks-*`, `hakan/*`) eski yollardadır; birleştirmede çakışırsa dal sahibi `eski/` yoluna taşır.

**Why:** Taşıma her ekip üyesinin yerel ortamını etkiler ve tek seferliktir; pull sonrası yapılacaklar ve tuzaklar başka oturumlarda da bilinmeli.
**How to apply:** Bir ekip üyesi "ekip hafızası yok", "kanca bulunamadı", "`.env` kayboldu" derse önce `eski-yerel-tasi.mjs` kuru çalıştırmasını öner. Açık dal birleştirmelerinde yol çakışması beklenir. Kararlar: [[eworks-hedef-mimari]]; çalışma biçimi: [[eworks-calisma-bicimi]]; senkron: [[ajan-senkron-betikleri]].
