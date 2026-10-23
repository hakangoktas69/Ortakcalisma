# Claude Code, Codex ve ekip hafızası

> İlgili: [hedef-mimari/09 — ajan bağlamı ve senkron tasarımı](../hedef-mimari/09-yapay-zeka-ajan-baglami.md) · [Ekip hafızası](../ai/memory/MEMORY.md) · [Kurallar](../ai/kurallar.md)

Claude Code ve Codex bu projede **sıfırdan başlamaz**. Kurallar, mimari, güncel durum ve ekibin öğrendikleri depodadır ve git ile sürümlenir. Hangi aracı kullanırsanız kullanın **aynı kaynakları** okur ve yazarsınız; bir araçtaki değişiklik ötekine kendiliğinden geçer (D31).

## Tek kaynak, üretilen yansımalar

| Elle yazılır (kaynak) | Üretilir (elle düzenlenmez) |
|---|---|
| `CLAUDE.md` (kök + `apps/*` vb. alt dizinler) | `AGENTS.md` (kök): okuma listesi, ekip hafızası, beceri eşlemesi, akış |
| `docs/ai/*.md` (vizyon, mimari, kurallar, test, durum) | `<dizin>/AGENTS.md`: her alt dizin `CLAUDE.md`'si için |
| `docs/ai/memory/*.md` (ekip hafızası kayıtları) | `docs/ai/memory/MEMORY.md`: eksik satırlar eklenir, silinen kaydın satırı kalkar |
| `docs/ai/beceriler/*.md` (hafiza, oryantasyon) | `.claude/skills/*/SKILL.md` |

Üretici `node tools/ajan/senkron.mjs`:

- `--yaz`: üretir ve değişenleri `git add` ile sahneler (`--sahneleme-yok` ile sahnelemez).
- `--denetle`: yazmaz, uyumsuzlukta 1 ile çıkar. `AGENTS.md`'ye blok dışında elle eklenmiş içerik varsa "kuralı CLAUDE.md veya docs/ai'ye taşı" der.
- `--kanca-kur`: `core.hooksPath = tools/git-hooks` ve Claude'un `autoMemoryDirectory` ayarı (`pnpm install` sırasında `prepare` çalıştırır).

`AGENTS.md`'nin hafıza bloğu `MEMORY.md`'nin güncel kopyasıdır. Son 14 günün değişikliği bloğa yazılmaz (üretim tarihe bağlı olur, CI'da denetim tutarsızlaşır); onun yerine `git log` komutu verilir.

## Ne zaman ne çalışır

| An | Claude kullanan | Codex kullanan | Araçtan bağımsız (git kancası) |
|---|---|---|---|
| Oturum başı | SessionStart → `tools/claude/session-start.mjs`: hafıza ayarı, `guncelle.mjs --ajan claude` (güvenliyse ileri sarar + senkron), son hafıza değişiklikleri | `AGENTS.md` → `node tools/ajan/guncelle.mjs --ajan codex`. Codex `AGENTS.md`'yi kendiliğinden yüklediği için komut çalışmasa da güncel hafızayı görür | — |
| `git pull` / dal değişimi | — | — | `post-merge`, `post-checkout` → `senkron --yaz --sahneleme-yok` + "ajan bağlamı değişti" uyarısı |
| İş bitince | Stop → `tools/claude/stop-bitir.mjs` kodda commitlenmemiş değişiklik varken `bitir.mjs --ajan claude` adımlarına yönlendirir (aynı dosya kümesi için bir kez; kapatmak: `AJAN_BITIR=off`) | `AGENTS.md` → `node tools/ajan/bitir.mjs --ajan codex` | — |
| Commit | — | — | `pre-commit` → `senkron --yaz` (üretilenler aynı commit'e girer) + hafıza değiştiyse `check-memory` |
| Push / CI | — | — | `pre-push` ve CI → `senkron --denetle` + `check-memory` |

`bitir.mjs` iki araç için **aynı** adımları yazar: değişikliği gözden geçir, kaynak belgeyi güncelle, öğrenimi hafızaya yaz, senkron, `pnpm verify`, commit. Senkron her durumda iki tarafı da kurar: Claude kullandıysanız Codex dosyaları, Codex kullandıysanız Claude dosyaları güncellenir.

### İnsan için sarmalayıcılar

```powershell
powershell -ExecutionPolicy Bypass -File tools\ajan\claude.ps1 -Mod guncelle   # ya da codex.ps1; -Mod bitir
```
```bash
./tools/ajan/claude.sh guncelle    # ya da codex.sh; bitir
```

`guncelle`: `git pull`, gelen commitler ve değişen bağlam dosyaları; ajanı bunları özetleten istemle yeni oturumda başlatır (komut satırında araç yoksa istem panoya kopyalanır). `bitir`: iş bitirme adımlarını panoya kopyalar; işin yapıldığı oturuma yapıştırın (`-Yeni` ile yeni oturum).

## Hafıza katmanları

| Katman | Dosya | Git'te | Ne yazılır |
|---|---|---|---|
| Kişisel, tüm projeler | `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` | hayır | Kişinin genel tercihleri |
| Proje | `CLAUDE.md` + `@docs/ai/*.md` | evet | Pazarlıksız kurallar, yapı, komutlar, mimari, durum |
| Alt dizin | `apps/*/CLAUDE.md` | evet | O dizine özel kurallar (o dizinde çalışınca yüklenir) |
| **Ekip hafızası** | `docs/ai/memory/` | evet | Öğrenilmiş, kodda görünmeyen bilgi |
| Kişisel, bu proje | `CLAUDE.local.md` | hayır | Kişinin bu projedeki notları |
| Paylaşılan ayar | `.claude/settings.json` | evet | Kancalar |
| Kişisel ayar | `.claude/settings.local.json` | hayır | Kanca `autoMemoryDirectory`'yi buraya yazar |

Claude Code `autoMemoryDirectory` ayarını güvenlik gereği paylaşılan `settings.json`'dan okumaz; bu yüzden SessionStart kancası (ve `pnpm install`) her makinede yerel ayara yazar. Değer yeniden yapılanma öncesi yolu (`mukellef-takip/docs/ai/memory`) gösteriyorsa kendiliğinden düzeltilir; başka bir değerse yalnız uyarılır.

### Hafızaya ne yazılır

| Bilgi | Yeri |
|---|---|
| Kodda veya git geçmişinde olan | hiçbir yer |
| Her oturumda uyulacak kural | `docs/ai/*.md` / `CLAUDE.md` |
| Karar | `docs/adr/karar-kaydi.md` + `hedef-mimari/01` + `docs/ai/durum.md` + hafıza `eworks-hedef-mimari` |
| Bağlamın kuralı, ucu, olayı | `docs/baglamlar/<context>.md` |
| Kullanıcının düzeltmesi ve gerekçesi; kodda görünmeyen kısıt veya durum; dış kaynak | **ekip hafızası** |
| Kişiye özel tercih | `CLAUDE.local.md` / `~/.codex/AGENTS.md` |
| Kişisel veri, sır, gerçek mükellef/müşavir bilgisi | **hiçbir yer** (`check-memory` + gitleaks) |

`node tools/claude/check-memory.mjs` her kaydın ön bilgisini, `MEMORY.md` tutarlılığını ve 200 satır sınırını, kişisel veri/sır kalıplarını denetler. Arşivdeki hafıza için: `--dizin eski/mukellef-takip/docs/ai/memory`.

## Beceriler

| Komut (Claude) | Codex | Ne yapar |
|---|---|---|
| `/oryantasyon` | "projeyi anlat" → `docs/ai/beceriler/oryantasyon.md` | Durum özeti, ortam kontrolü, role göre okuma yolu, ilk iş |
| `/hafiza <bilgi>` | "hafızaya yaz" → `docs/ai/beceriler/hafiza.md` | Bilgiyi doğru katmana yazar |
| `/hafiza aktar` · `/hafiza denetle` | aynı dosya | Kişisel hafızayı aktarır · eskimiş kayıtları bulur |

Codex'in proje içi beceri desteği doğrulanana kadar eşleme `AGENTS.md`'nin "Beceriler" bloğundadır ([durum](../ai/durum.md), açık konu).

## Depo yeniden yapılanmasından sonra (bir kez)

```bash
git pull
node tools/ajan/eski-yerel-tasi.mjs            # ne yapılacağını listeler
node tools/ajan/eski-yerel-tasi.mjs --uygula   # yerel dosyaları eski/ altına taşır, eski ayarları düzeltir
```

Sonra Claude Code / Codex'te yeni oturum açın.

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Claude ekip hafızasını bilmiyor | Kancalar kapalı ya da `node` PATH'te yok. `/hooks` ile bakın; elle: `node tools/claude/session-start.mjs` |
| "autoMemoryDirectory başka bir dizini gösteriyor" | `settings.local.json`'da bilinçli olmayan bir değer var: satırı silin, kanca doğrusunu yazar |
| `pre-push` "senkron değil" diyor | `node tools/ajan/senkron.mjs --yaz`, değişiklikleri commitleyin; `AGENTS.md`'ye elle kural yazdıysanız kaynağa taşıyın |
| Kancalar çalışmıyor | `git config core.hooksPath` → `tools/git-hooks` olmalı: `node tools/ajan/senkron.mjs --kanca-kur` |
| `eski/mukellef-takip` üzerinde çalışmak gerekiyor | Arşivdir (D32). Gerekirse o klasörü ayrı proje olarak açın; kendi `.claude` kancaları çalışır |
