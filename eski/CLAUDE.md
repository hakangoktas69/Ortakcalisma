> **ARŞİV (2026-10-24, D28).** Bu dosya yeniden yapılanma öncesi depo kökünün bağlamıdır; içindeki yollar taşıma öncesine göredir (`mukellef-takip/` → `eski/hakan/mukellef-takip/` vb.). Güncel bağlam: depo kökündeki `CLAUDE.md` ve `AGENTS.md`. Ayrıntı: [README.md](README.md).

# Ortakcalisma — ortak çalışma deposu

Mali müşavir portalı üzerinde çalışan ekip üyelerinin klasörleri. Her klasör sahibinindir; başka birinin klasöründe değişiklik yapmadan önce kullanıcıya sor.

| Klasör | İçerik | Claude bağlamı |
|---|---|---|
| `mukellef-takip/` | Mükellef Takip — NestJS + Next.js + Chrome eklentisi, DDD modüler monolit, Docker (ana proje) | `mukellef-takip/CLAUDE.md` |
| `hakan/` | Hakan'ın kişisel çalışma klasörü | — |
| `mert/eworks` | Eworks portalı + Python GİB robotu (Supabase) | `hkazaz/eworks/CLAUDE.md` (çalışmadan önce oku) |
| `hkazaz/` | Analiz dokümanları, Eworks dokümantasyonu (`hkazaz/eworks/`), iki projenin Docker denemeleri | — |
| `yunus/` | — | — |

Bir projede çalışırken o projenin `CLAUDE.md`'si ve `docs/ai/` belgeleri esastır (proje klasöründe çalışıldığında otomatik yüklenir).
Ortak kural: sır, `.env`, kişisel veri (TCKN, gerçek mükellef bilgisi) commit edilmez.

**Ekip hafızası:** Claude Code'un otomatik hafızası, kök `.claude/settings.json`'daki SessionStart kancasıyla `mukellef-takip/docs/ai/memory/` dizinine yönlendirilir ve git ile paylaşılır (rehber: `mukellef-takip/docs/05-gelistirici-rehberi/05-claude-code.md`). Başka bir klasör (`mert/eworks` vb.) için öğrenilen bilgi o klasörün kendi `CLAUDE.md`'sine aittir; ekip hafızasına yazacaksan kaydın başında hangi klasöre ait olduğunu belirt. Kişiye özel tercihler `CLAUDE.local.md`'ye yazılır (gitignore'da). Bağlamda ekip hafızası yoksa mukellef-takip işine başlamadan `mukellef-takip/docs/ai/memory/MEMORY.md`'yi oku.
