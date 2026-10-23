---
name: claude-baglami-depoda
description: Proje bilgisi kişisel hafızada değil depoda tutulur (CLAUDE.md, docs/ai, docs/ai/memory) ki repoyu çeken herkesin Claude'u aynı bağlamla çalışsın
metadata:
  type: feedback
---

Strateji, vizyon, mimari, modüller, teknoloji yığını ve güvenlik kararları proje ağacında tutulur: `CLAUDE.md` dosyaları, `docs/ai/*.md`, `docs/adr/*` ve öğrenilmiş bilgiler için bu dizin (`docs/ai/memory/`).

**Why:** Depo ortak; Hakan, Mert, Yunus ve hkazaz aynı repoda çalışıyor. Repoyu çeken her geliştiricinin Claude Code'u projeyi sıfırdan keşfetmeden aynı şekilde anlamalı.
**How to apply:** Mimari, güvenlik kuralı veya teknoloji kararı değiştiğinde ilgili `CLAUDE.md` / `docs/ai` dosyasını aynı değişiklikte güncelle. Kalıcı kural → `docs/ai/*.md`; gerekçeli karar → ADR; kodda görünmeyen, öğrenilmiş bilgi → bu hafıza. Kişiye özel tercih (`user` türü) buraya değil `CLAUDE.local.md` veya `~/.claude/CLAUDE.md`'ye yazılır. Düzen: [[ekip-hafizasi-duzeni]].
