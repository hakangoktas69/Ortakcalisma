---
name: eworks-dokumantasyonu
description: "[mert/eworks] Eworks belgeleri ve Claude bağlamı hkazaz/eworks'te; mert/eworks'te çalışmadan önce hkazaz/eworks/CLAUDE.md oku"
metadata:
  type: reference
---

Klasör: mert/eworks

Eworks (Supabase portalı + Python/Playwright GİB robotu) için rol bazlı dokümantasyon, mimari/güvenlik risk kayıtları ve Claude/Codex bağlamı `hkazaz/eworks/` altındadır (2026-10-23, kaynak `51e2cd1`). `mert/eworks`'ün kendi `CLAUDE.md`'si yoktur; Mert'in onayı olmadan oraya dosya konmadı.

- Giriş: `hkazaz/eworks/CLAUDE.md` (+ `ai/baglam.md`, `ai/kurallar.md`, `ai/durum-ve-riskler.md`); insanlar için `hkazaz/eworks/README.md`.
- Risk numaraları `G-NN` (güvenlik) ve `M-NN` (mimari) bu belgelerde tanımlıdır; konuşmada ve commit'te bu kimliklerle anılır.
- Kodda görünmeyen kritik nokta: Eworks kullanıcı belgeleri "CAPTCHA'yı kullanıcı girer" der, 21.10 kodu ise otomatik giriş yapar (G-01). Bu, Mükellef Takip'in "otomatik GİB girişi yok" kuralıyla çelişir; Eworks robotu Mükellef Takip'e bağlanırken bu kural esastır.

**Why:** Kök oturumların hafızası buraya yazıldığından Eworks işi yapan ajan bu dizini görür ama Eworks bağlamını göremez.
**How to apply:** `mert/eworks` veya Eworks–Mükellef Takip entegrasyonu işinde önce `hkazaz/eworks/CLAUDE.md`'yi oku; Eworks'e özgü yeni bilgi önce oradaki belgelere, kodda/belgede görünmeyen öğrenim ise `eworks-` önekli kayıtla buraya. Mükellef Takip tarafı: [[ddd-yeniden-yapilandirma]], ekip düzeni: [[ekip-hafizasi-duzeni]].
