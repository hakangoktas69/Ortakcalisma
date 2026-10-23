---
name: ekip-hafizasi-duzeni
description: Claude Code otomatik hafızası depodaki docs/ai/memory dizinine yönlendirilir; kanca, denetim betiği, senkron, kayıt kuralları ve Obsidian kasası
metadata:
  type: reference
---

- `tools/claude/session-start.mjs` (SessionStart kancası, kök `.claude/settings.json`) her oturumda geliştiricinin `.claude/settings.local.json` dosyasına `autoMemoryDirectory` = bu dizinin mutlak yolunu yazar. Claude Code bu ayarı paylaşılan `settings.json`'dan güvenlik gereği okumaz; bu yüzden kanca yerel ayara yazıyor. Değer yeniden yapılanma öncesi yolu (`mukellef-takip/docs/ai/memory`) gösteriyorsa kendiliğinden düzeltilir; başka bir değerse yalnız uyarılır.
- `node tools/claude/check-memory.mjs` (pre-commit'te hafıza değiştiyse, pre-push'ta, `pnpm verify`'da ve CI'da) ön bilgiyi, indeksi ve kişisel veri/sır kalıplarını denetler. Arşivdeki hafıza: `--dizin eski/mukellef-takip/docs/ai/memory`.
- `MEMORY.md` git'te `merge=union` ile birleşir; aynı anda eklenen satırlar çakışma çıkarmaz. Eksik ya da dosyası silinmiş satırı `senkron --yaz` düzeltir, mükerrer satırı `check-memory` yakalar.
- Hafıza Codex'e `AGENTS.md`'nin hafıza bloğuyla geçer (senkron üretir); Codex'in yazdığı kayıt da aynı dizine gider.
- Hafıza değişiklikleri kod gibi PR'da incelenir. `/hafiza` becerisi kayıt ekler, kişisel hafızayı aktarır; `/oryantasyon` yeni geliştiriciyi karşılar (kaynakları `docs/ai/beceriler/`).
- `docs/` bir Obsidian kasasıdır; çift köşeli parantezli bağlantılar dosya adına çözülür.

Ayrıntı: `docs/gelistirici-rehberi/claude-codex.md`. İlgili: [[claude-baglami-depoda]], [[ajan-senkron-betikleri]].
