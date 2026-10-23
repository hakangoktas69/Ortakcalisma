---
name: ajan-senkron-betikleri
description: Claude/Codex arasında değişiklik taşıma — guncelle (işe başlarken) ve bitir (iş bitince) betikleri, senkron.mjs ve git kancaları; Claude'da kancalar yapar, Codex'te AGENTS.md talimatı
metadata:
  type: reference
---

Bir ekip üyesinin değişikliği öteki ajana **commit/pull ile** geçer; araca özel dosyalar (`AGENTS.md`, `MEMORY.md` dizini, `.claude/skills`) kaynaktan üretilir (`node tools/ajan/senkron.mjs --yaz`). Git kancaları (`tools/git-hooks`, `pnpm install` ya da `senkron.mjs --kanca-kur` kurar) pull/checkout sonrası yeniden üretir ve uyarır, commit'te sahneler, push'ta denetler.

```bash
node tools/ajan/guncelle.mjs --ajan claude|codex          # ajan modu: güvenliyse ileri sarar, senkron, talimat
node tools/ajan/guncelle.mjs --ajan claude|codex --cek    # insan: git pull + yeni oturum istemi
node tools/ajan/bitir.mjs --ajan claude|codex             # iş bitirme adımları (iki araçta aynı)
powershell -ExecutionPolicy Bypass -File tools\ajan\claude.ps1 -Mod guncelle|bitir   # Windows sarmalayıcı (codex.ps1, *.sh)
```

- `guncelle` — işe başlarken ve ekipten "push ettim" haberi gelince. Ajan modunda yalnız güvenliyse ileri sarar (temiz ağaç, ayrışmamış dal, ff-only); değilse kullanıcıya `--cek` önerir.
- `bitir` — iş bitince, commit/push'tan önce: senkron + hafıza denetimini çalıştırır, kaynak belge / hafıza / test / commit adımlarını yazar. Senkron her durumda iki tarafı da kurar.
- Claude kullanan çoğu zaman elle çalıştırmaz: SessionStart kancası `guncelle --ajan claude`, Stop kancası kodda commitlenmemiş değişiklik varken `bitir`'e yönlendirir (kapatmak: `AJAN_BITIR=off`). Codex'te kanca yok; `AGENTS.md` "Akış" bloğu zorunlu kılar, git kancaları yine çalışır.
- Eski `mukellef-takip/tools/ajan/*.ps1` (PowerShell mantığı) Node'a taşındı; `.ps1`/`.sh` yalnız sarmalayıcı.

Rehber: `docs/gelistirici-rehberi/claude-codex.md`; tasarım: `docs/hedef-mimari/09-yapay-zeka-ajan-baglami.md`. İlgili: [[ekip-hafizasi-duzeni]], [[claude-baglami-depoda]].
