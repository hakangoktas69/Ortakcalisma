<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->
# Eworks — kodlama ajanı talimatları (Codex vb.)

Bu dosya **üretilir**; kural burada yazılmaz ve tekrarlanmaz. Kaynaklar: `CLAUDE.md` (kök ve alt dizinler), `docs/ai/`, `docs/ai/memory/`, `docs/ai/beceriler/`. Claude Code kullanan ekip üyeleriyle **aynı bağlamı** kullanırsın; çelişki olursa kaynak dosya geçerlidir. Senkron: [docs/hedef-mimari/09](docs/hedef-mimari/09-yapay-zeka-ajan-baglami.md).

<!-- senkron:baslangic okuma-listesi -->
## Okuma listesi (oturum başında, kod yazmadan önce)

1. `CLAUDE.md` — proje belleği ve **pazarlıksız kurallar** (senin için de bağlayıcıdır). İçindeki `@yol` satırları içe aktarımdır; şunları da sırayla oku:
   - `docs/ai/vizyon.md` — ürün, kullanıcılar, kapsam, ilkeler
   - `docs/ai/mimari.md` — bileşenler, bounded context'ler, katmanlar, veri ve sharding
   - `docs/ai/kurallar.md` — pazarlıksız kurallar, kod üslubu, kararların işlenme biçimi
   - `docs/ai/test.md` — TDD akışı, test katmanları, özellik durumu (kırmızı/yeşil)
   - `docs/ai/durum.md` — şu anki durum, açık konular, sıradaki işler (işe başlamadan bak)
2. Çalıştığın dizinin bağlamı (o dizindeki `AGENTS.md` aynı dosyayı gösterir):
   - `apps/sales/CLAUDE.md`
   - `apps/web/CLAUDE.md`
   - `apps/worker/CLAUDE.md`
3. Bir bağlamda çalışacaksan `docs/baglamlar/<context>.md`; karar ve gerekçe için `docs/adr/karar-kaydi.md` ve `docs/hedef-mimari/`.
<!-- senkron:bitis okuma-listesi -->

<!-- senkron:baslangic hafiza -->
## Ekip hafızası (`docs/ai/memory/`)

Claude Code bu dizine otomatik yazar; sende otomatik hafıza yok, aynı biçimi elle uygula:

- Tek bilgi = tek dosya `docs/ai/memory/<kebab-ad>.md`; ön bilgi `name` (= dosya adı), `description` (tek satır), `metadata.type` (`feedback` | `project` | `reference`). `feedback`/`project` gövdesinde **Why:** ve **How to apply:** satırları; ilgili kayıtlara `[[ad]]`.
- Önce benzer kayıt var mı bak; varsa güncelle. Göreli tarihi mutlak yaz. `MEMORY.md` satırını unutursan senkron ekler.
- Kişiye özel tercih (`~/.codex/AGENTS.md`'ye), kişisel veri ve sır hiçbir yere yazılmaz. Sonra `node tools/claude/check-memory.mjs`.
- Son değişiklikler: `git log --since=14.days --date=short --format="%h %ad %an: %s" -- docs/ai/memory`

Güncel dizin (`MEMORY.md`):
<!-- senkron:bitis hafiza -->

<!-- senkron:baslangic beceriler -->
## Beceriler

İstek aşağıdakilerden birine uyuyorsa ilgili dosyayı oku ve adımlarını uygula (Claude'a özgü araç adlarını kendi araçlarınla karşıla):

- **hafiza** → `docs/ai/beceriler/hafiza.md` — Ekip hafızasına (docs/ai/memory) kayıt ekler veya günceller, kişisel Claude hafızasındaki proje kayıtlarını ekip hafızasına aktarır, hafızayı denetler. "Bunu hatırla", "hafızaya yaz", "ekip bilsin", "/hafiza aktar", "/hafiza denetle" dendiğinde kullan.
- **oryantasyon** → `docs/ai/beceriler/oryantasyon.md` — Projeye yeni katılan geliştiriciyi karşılar — rolüne göre okuma yolu, güncel durum, ortam kontrolü ve ilk işi önerir. "Projeye yeni katıldım", "nereden başlamalıyım", "projeyi anlat", "/oryantasyon" dendiğinde kullan.
<!-- senkron:bitis beceriler -->

<!-- senkron:baslangic akis -->
## Akış (zorunlu)

- **Oturum başında**, kullanıcı başka bir şey istese de önce: `node tools/ajan/guncelle.mjs --ajan codex` — çıktısı varsa (ekipten gelen değişiklik, değişen bağlam dosyaları) ona uy. Ağ izni yoksa çıktı bunu söyler.
- **İşi bitirmeden ve commitlemeden önce**: `node tools/ajan/bitir.mjs --ajan codex` — çıktısındaki adımların hepsini uygula (kaynak belgeler, hafıza, senkron, testler, commit).
- Kural, mimari veya durum değişikliği bu dosyaya **yazılmaz**: `CLAUDE.md`, `docs/ai/*.md`, `docs/adr/karar-kaydi.md` veya ilgili `docs/baglamlar/` sayfasına yazılır. Bu dosyaya elle eklenen içerik `senkron --denetle`'de (pre-push, CI) hata verir.
<!-- senkron:bitis akis -->
