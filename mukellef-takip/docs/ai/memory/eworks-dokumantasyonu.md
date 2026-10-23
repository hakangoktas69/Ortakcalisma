---
name: eworks-dokumantasyonu
description: "[mert/eworks] Eworks belgeleri ve Claude bağlamı hkazaz/eworks'te; mert/eworks'te veya Eworks hedef mimarisinde çalışmadan önce hkazaz/eworks/CLAUDE.md oku"
metadata:
  type: reference
---

Klasör: mert/eworks

Eworks (Supabase portalı + Python/Playwright GİB robotu) için rol bazlı dokümantasyon, risk kayıtları, hedef mimari ve Claude/Codex bağlamı `hkazaz/eworks/` altındadır (oluşturma 2026-10-23, kaynak `51e2cd1`; hedef mimari 2026-10-24). `mert/eworks`'ün kendi `CLAUDE.md`'si yoktur; Mert'in onayı olmadan oraya dosya konmadı.

- Giriş: `hkazaz/eworks/CLAUDE.md` (+ `ai/baglam.md`, `ai/kurallar.md`, `ai/durum-ve-riskler.md`); insanlar için `hkazaz/eworks/README.md`.
- Bugünkü durum: `02-mimari/`, `04-eksikler-ve-riskler/` (risk kimlikleri `G-NN` güvenlik, `M-NN` mimari).
- Hedef (çok kiracılı SaaS): `05-hedef-mimari/01…09` (01 genel bakış + kararlar D1–D31, 02 kurum entegrasyonları, 03 kapasite, 04 dağıtım, 05 yetki/hesap, 06 kod yapısı DDD/TDD, 07 saklama/sharding, 08 depo yeniden yapılanması, 09 Claude↔Codex senkronu). Karar kaydı `02-mimari/05-mimari-kararlar.md` (K-01…K-38). Özet: [[eworks-hedef-mimari]]. Açık konular: [[eworks-acik-konular]]. Yeniden yapılanma: [[eworks-yeniden-yapilanma]]. Çalışma biçimi: [[eworks-calisma-bicimi]].
- Bugünkü kodda görünmeyen nokta: kullanıcı belgeleri "CAPTCHA'yı kullanıcı girer" der, 21.10 kodu otomatik giriş yapar (G-01). Hedef mimaride otomatik CAPTCHA bilinçli karardır (D6/K-15).

**Why:** Kök oturumların hafızası buraya yazıldığından Eworks işi yapan ajan bu dizini görür ama Eworks bağlamını göremez.
**How to apply:** `mert/eworks` veya Eworks hedef mimarisi işinde önce `hkazaz/eworks/CLAUDE.md`'yi oku; Eworks'e özgü yeni bilgi önce oradaki belgelere (karar → `K-NN`, durum → `ai/durum-ve-riskler.md`), kodda/belgede görünmeyen öğrenim `eworks-` önekli kayıtla buraya. Mükellef Takip ayrı üründür: [[ddd-yeniden-yapilandirma]]; ekip düzeni: [[ekip-hafizasi-duzeni]].
