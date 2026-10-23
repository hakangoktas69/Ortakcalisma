---
name: claude-baglami-depoda
description: Proje bilgisi kişisel hafızada değil depoda tutulur (CLAUDE.md, docs/ai, docs/ai/memory) ki repoyu çeken herkesin Claude'u ve Codex'i aynı bağlamla çalışsın
metadata:
  type: feedback
---

Strateji, vizyon, mimari, modüller, teknoloji yığını ve güvenlik kararları proje ağacında tutulur: `CLAUDE.md` dosyaları, `docs/ai/*.md`, `docs/adr/*`, `docs/hedef-mimari/*` ve öğrenilmiş bilgiler için bu dizin (`docs/ai/memory/`).

**Why:** Depo ortak; birden çok ekip üyesi aynı repoda Claude Code ya da Codex ile çalışıyor. Repoyu çeken her geliştiricinin ajanı projeyi sıfırdan keşfetmeden aynı şekilde anlamalı (D31).
**How to apply:** Mimari, güvenlik kuralı veya teknoloji kararı değiştiğinde ilgili `CLAUDE.md` / `docs/ai` dosyasını aynı değişiklikte güncelle. Kalıcı kural → `docs/ai/*.md`; karar → `docs/adr/karar-kaydi.md` (+ D-NN, durum, hafıza); kodda görünmeyen, öğrenilmiş bilgi → bu hafıza. `AGENTS.md`'ye kural yazılmaz (üretilir). Kişiye özel tercih (`user` türü) buraya değil `CLAUDE.local.md` veya `~/.claude/CLAUDE.md`'ye yazılır. Düzen: [[ekip-hafizasi-duzeni]].
