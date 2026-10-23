> **ARŞİV (2026-10-24, D32 / K-39).** Mükellef Takip artık geliştirilmiyor; bu klasör referans olarak `eski/` altında duruyor. Depo kökü Eworks SaaS projesidir: `../../CLAUDE.md`, `../../AGENTS.md`. Ekip hafızası kök `docs/ai/memory/`; buradaki `docs/ai/memory/` yalnız Mükellef Takip kayıtlarını tutar. CI yalnız elle tetiklenir. Bu klasörde değişiklik yapmadan önce kullanıcıya sor.

# Mükellef Takip — kodlama ajanı talimatları (Codex vb.)

Bu projenin ajan bağlamı Claude Code için yazılmıştır ama araçtan bağımsızdır; aynısına uy. Belgelerde "Claude" geçen talimatlar senin için de geçerlidir.
Kurallar burada **tekrarlanmaz**; kaynak aşağıdaki dosyalardır. Çelişki olursa kaynak dosya geçerlidir.

## Oturum başında (her seferinde, kod yazmadan önce)

0. **Zorunlu ilk komut**, kullanıcı başka bir şey istese de önce bunu çalıştır ve çıktısına uy (çıktı boşsa ekip değişikliği yoktur):
   `powershell -NoProfile -ExecutionPolicy Bypass -File tools/ajan/codex.ps1 -Mod guncelle -Ajan`
   (Windows dışında `pwsh`). Ağ izni yoksa çıktı bunu söyler; kullanıcıdan izin iste ya da `codex.ps1 -Mod guncelle` çalıştırmasını öner.
1. `CLAUDE.md`'yi (bu dizin) oku. İçindeki `@docs/ai/x.md` satırları içe aktarımdır; o dosyaları da oku: vision, architecture, bounded-contexts, tech-stack, security-kvkk, conventions, testing, roadmap.
2. Çalıştığın uygulamanın kuralını oku: `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`.
3. Ekip hafızası: `docs/ai/memory/MEMORY.md` indeksini oku, konuyla ilgili kayıtları aç. Son değişiklikler:
   `git log --since=14.days --format="%h %ad %an: %s" --date=short -- docs/ai/memory`
4. Bir bağlamda çalışacaksan `docs/02-baglamlar/<context>.md`; yeni uç/olay/tablo/context eklerken `docs/05-gelistirici-rehberi/02-tarifler.md`.

`CLAUDE.md`'deki "Pazarlıksız kurallar" senin için de bağlayıcıdır; ihlal gerekiyorsa önce kullanıcıya sor.

## Bilgi nereye yazılır

`docs/05-gelistirici-rehberi/05-claude-code.md` → "Hafızaya ne yazılır" tablosu. Özet: kalıcı kural → `CLAUDE.md` / `docs/ai/*.md`, gerekçeli karar → `docs/adr/`, bağlam bilgisi → `docs/02-baglamlar/`, öğrenilmiş ve kodda görünmeyen bilgi → `docs/ai/memory/`, kişiye özel tercih → paylaşılan hiçbir dosya, kişisel veri/sır → hiçbir yer.

## Ekip hafızasına yazarken

Claude'un otomatik hafızası bu dizine yazar; sende otomatik hafıza yok, aynı biçimi elle uygula:

- Tek bilgi = tek dosya: `docs/ai/memory/<kebab-ad>.md`. Ön bilgi: `name` (= dosya adı), `description` (tek satır), `metadata.type` (`feedback` | `project` | `reference`). `feedback`/`project` gövdesinde **Why:** ve **How to apply:** satırları; ilgili kayıtlara `[[ad]]` bağlantısı. Örnek: mevcut kayıtlar.
- `MEMORY.md`'ye tek satır işaretçi ekle: `- [Başlık](dosya.md) — kısa kanca`. İçerik indekse yazılmaz.
- Önce benzer kayıt var mı bak; varsa güncelle, yanlışsa sil. Göreli tarihleri mutlak tarihe çevir.
- Sonra `npm run memory:check` çalıştır.
- "Hatırla / hafızaya yaz / aktar / denetle" istenirse `.claude/skills/hafiza/SKILL.md`'yi oku ve adımlarını uygula (Claude'a özgü araç adlarını kendi araçlarınla karşıla). Yeni geliştirici karşılama: `.claude/skills/oryantasyon/SKILL.md`.

## İşi bitirmeden önce

**Zorunlu:** Kodda (`apps/`, `infra/`, `tools/`) değişiklik yaptıysan, işi bitti saymadan ve commitlemeden önce şunu çalıştır ve çıktısındaki adımların hepsini uygula:
`powershell -NoProfile -ExecutionPolicy Bypass -File tools/ajan/codex.ps1 -Mod bitir -Ajan`
Aşağıdaki iki paragraf bu adımların özetidir.

Değişiklik mimariyi, bir kuralı, ucu, olayı, bağlam sınırını veya teknoloji kararını etkilediyse ilgili kaynağı **aynı değişiklikte** güncelle: `CLAUDE.md` / `apps/*/CLAUDE.md`, `docs/ai/*.md`, gerekirse yeni `docs/adr/` kaydı, `docs/02-baglamlar/<context>.md`; durum değiştiyse `docs/ai/roadmap.md`. Bunu atlarsan Claude kullanan ekip üyeleri değişikliği bilmez.

`docs/ai/testing.md` → "Bir işi tamamlarken": testleri ekle/revize et, tüm regresyonu çalıştır (`npm run verify`; arayüz değiştiyse yığın ayaktayken `npm run test:ui`), önyüzde 4 ekranı denetle (`apps/web/CLAUDE.md`). Kırmızı test bırakma; koşulamayan adımı kullanıcıya açıkça söyle.
Node 24 gerekir; yerel Node eskiyse `npm run verify` Docker'da koşar.
