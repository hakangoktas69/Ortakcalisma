---
name: ekip-hafizasi-duzeni
description: Claude Code otomatik hafızası depodaki docs/ai/memory dizinine yönlendirilir; kanca, denetim betiği, kayıt kuralları ve Obsidian kasası
metadata:
  type: reference
---

- `tools/claude/session-start.mjs` (SessionStart kancası; hem repo kökü hem `mukellef-takip/.claude/settings.json` içinde kayıtlı) her oturumda geliştiricinin `.claude/settings.local.json` dosyasına `autoMemoryDirectory` = bu dizinin mutlak yolunu yazar. Claude Code bu ayarı paylaşılan `settings.json`'dan güvenlik gereği okumaz; bu yüzden kanca yerel ayara yazıyor.
- `node tools/claude/check-memory.mjs` (CI'da ve `npm run verify` başında) ön bilgiyi, indeksi ve kişisel veri/sır kalıplarını denetler.
- `MEMORY.md` git'te `merge=union` ile birleşir; aynı anda eklenen satırlar çakışma çıkarmaz, mükerrer satır elle temizlenir.
- Hafıza değişiklikleri kod gibi PR'da incelenir. `/hafiza` becerisi kayıt ekler, kişisel hafızayı aktarır; `/oryantasyon` yeni geliştiriciyi karşılar.
- `docs/` bir Obsidian kasasıdır; çift köşeli parantezli bağlantılar dosya adına çözülür.

Ayrıntı: `docs/05-gelistirici-rehberi/05-claude-code.md`. İlgili: [[claude-baglami-depoda]].
