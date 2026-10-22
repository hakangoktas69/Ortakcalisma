---
name: ajan-senkron-betikleri
description: "Claude/Codex arasında değişiklik taşıma betikleri tools/ajan/{claude,codex}.ps1 — guncelle (işe başlarken) ve bitir (iş bitince) komutları; ajan -Ajan ile kendisi çalıştırır"
metadata:
  node_type: memory
  type: reference
  originSessionId: 92f07d49-b6b5-4d0f-85f2-f4c491f23b82
  modified: 2026-10-22T20:06:54.465Z
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

**Ne zaman:**
- `guncelle` — işe başlarken: güne/yeni işe başlamadan, ajanla yeni oturum açmadan önce ve ekipten "push ettim" haberi gelince. Pull yapar, gelen commitleri ve değişen bağlam dosyalarını listeler, ajanı bunları özetleten istemle başlatır (CLI yoksa istem panoya).
- `bitir` — iş bitince, commit/push'tan önce. İstemi panoya kopyalar; **işi yapan oturuma** yapıştırılır (bağlamı o bilir). Ajan belgeleri, hafızayı, testleri tamamlar ve commitler; sonra kullanıcı gözden geçirir, `git push` + PR, ekibe haber verir.
- Akış: `guncelle → geliştirme → bitir → gözden geçir → push + PR → ekibe haber` → diğerleri `guncelle`.

**Elle mi:** Claude kullanan çoğu zaman hiçbirini elle çalıştırmaz; kancalar yapar. Elle yalnız ajan uyarınca: otomatik çekilemedi (yerel değişiklik/ayrışmış dal) ya da bitirme adımları eksik kaldı. Codex kullanan en az `bitir`'i her işin sonunda elle çalıştırmalı (kanca yok, uyum talimata bağlı); `guncelle`'yi Codex atlarsa ya da ağ izni yoksa.

**Ajanın kendisi** aynı betiği `-Ajan` ile çalıştırır (oturum açmaz, panoya yazmaz; çıktı ajana talimattır):
- Claude: SessionStart kancası `claude.ps1 -Mod guncelle -Ajan`, Stop kancası (`tools/claude/stop-bitir.mjs`) kodda commitlenmemiş değişiklik varken `-Mod bitir -Ajan` adımlarına yönlendirir. Kapatmak: `AJAN_BITIR=off`.
- Codex: kanca yok; `AGENTS.md` oturum başında ve iş bitiminde bu komutları zorunlu kılar.

`guncelle -Ajan` yalnız güvenliyse ileri sarar (temiz çalışma ağacı, ayrışmamış dal); değilse kullanıcıya `-Mod guncelle` önerir. Rehber: `docs/05-gelistirici-rehberi/05-claude-code.md`. İlgili: [[ekip-hafizasi-duzeni]], [[claude-baglami-depoda]].
