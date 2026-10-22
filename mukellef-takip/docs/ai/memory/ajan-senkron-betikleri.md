---
name: ajan-senkron-betikleri
description: "Claude/Codex arasında değişiklik taşıma betikleri tools/ajan/{claude,codex}.ps1 — guncelle (işe başlarken) ve bitir (iş bitince) komutları; ajan -Ajan ile kendisi çalıştırır"
metadata:
  node_type: memory
  type: reference
  originSessionId: 92f07d49-b6b5-4d0f-85f2-f4c491f23b82
  modified: 2026-10-22T19:46:35.722Z
---

Bir ekip üyesinin kod/mimari değişikliği öteki ajana kendiliğinden geçmez: belge güncellenir → push → öteki pull eder → yeni oturum. Bu akışı `tools/ajan/` betikleri yapar (depo kökünden):

```powershell
# Claude kullanan
powershell -ExecutionPolicy Bypass -File mukellef-takip\tools\ajan\claude.ps1 -Mod guncelle
powershell -ExecutionPolicy Bypass -File mukellef-takip\tools\ajan\claude.ps1 -Mod bitir

# Codex kullanan
powershell -ExecutionPolicy Bypass -File mukellef-takip\tools\ajan\codex.ps1 -Mod guncelle
powershell -ExecutionPolicy Bypass -File mukellef-takip\tools\ajan\codex.ps1 -Mod bitir
```

**Ajanın kendisi** aynı betiği `-Ajan` ile çalıştırır (oturum açmaz, panoya yazmaz; çıktı ajana talimattır):
- Claude: SessionStart kancası `claude.ps1 -Mod guncelle -Ajan`, Stop kancası (`tools/claude/stop-bitir.mjs`) kodda commitlenmemiş değişiklik varken `-Mod bitir -Ajan` adımlarına yönlendirir. Kapatmak: `AJAN_BITIR=off`.
- Codex: kanca yok; `AGENTS.md` oturum başında ve iş bitiminde bu komutları zorunlu kılar.

`guncelle -Ajan` yalnız güvenliyse ileri sarar (temiz çalışma ağacı, ayrışmamış dal); değilse kullanıcıya `-Mod guncelle` önerir. Rehber: `docs/05-gelistirici-rehberi/05-claude-code.md`. İlgili: [[ekip-hafizasi-duzeni]], [[claude-baglami-depoda]].
