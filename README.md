# Ortakcalisma

Mali müşavir portalı ortak çalışma deposu. Klasörler ve sahipleri: [CLAUDE.md](CLAUDE.md). Ana proje: [mukellef-takip/](mukellef-takip/README.md).

## Yapay zekâ ajanlarıyla çalışma (Claude Code / Codex)

| Komut | Ne zaman |
|---|---|
| `powershell -ExecutionPolicy Bypass -File mukellef-takip\tools\ajan\claude.ps1 -Mod guncelle` (Codex: `codex.ps1`) | İşe başlarken; ekipten değişiklik gelince |
| `powershell -ExecutionPolicy Bypass -File mukellef-takip\tools\ajan\claude.ps1 -Mod bitir` (Codex: `codex.ps1`) | İş bitince, commit/push'tan önce |

Claude'da kancalar bunları çoğunlukla kendiliğinden yapar; Codex'te `bitir`'i her işin sonunda elle çalıştırın. Ayrıntı: [mukellef-takip/README.md](mukellef-takip/README.md#yapay-zekâ-ajanlarıyla-çalışma-claude-code--codex).
