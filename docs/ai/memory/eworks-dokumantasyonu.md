---
name: eworks-dokumantasyonu
description: Eworks belgeleri nerede — hedef mimari docs/hedef-mimari, eski pilotun analizi docs/arsiv/mevcut-durum, karar kaydı docs/adr; G-NN/M-NN risk kimlikleri arşivde
metadata:
  type: reference
---

Depo yeniden yapılanmasından (2026-10-24) sonra Eworks belgeleri:

- **Hedef mimari** (yeni kodun dayanağı): `docs/hedef-mimari/01…09` — 01 genel bakış + kararlar D1–D35, 02 kurum entegrasyonları, 03 kapasite, 04 dağıtım, 05 yetki/hesap, 06 kod yapısı DDD/TDD, 07 saklama/sharding, 08 depo yeniden yapılanması, 09 Claude↔Codex senkronu.
- **Karar kaydı:** `docs/adr/karar-kaydi.md` (K-01…K-42); uzun gerekçeler `docs/adr/NNNN-*.md`.
- **Eski Eworks pilotunun analizi** (yalnız referans): `docs/arsiv/mevcut-durum/` — `02-mimari/`, `03-gelistirici-rehberi/`, `04-eksikler-ve-riskler/` (risk kimlikleri `G-NN` güvenlik, `M-NN` mimari), `ai/` ve eski bağlam `CLAUDE.eski.md`. Kod: `eski/mert/eworks/entegrasyon-1-tarayici/` (belgelerde `E1/`).
- Eski kodda görünmeyen nokta: eski kullanıcı belgeleri "CAPTCHA'yı kullanıcı girer" der, 21.10 kodu otomatik giriş yapar (G-01). Hedef mimaride otomatik CAPTCHA bilinçli karardır (D6/K-15).

**Why:** Belgeler iki kez yer değiştirdi (`hkazaz/eworks` → `docs/`); eski yolları hatırlayan ekip üyesi ya da eski oturum özetleri yanlış yere bakabilir.
**How to apply:** Eski yol (`hkazaz/eworks/...`, `05-hedef-mimari/...`, `02-mimari/05-mimari-kararlar.md`) görürsen yukarıdaki yeni yere çevir. Kararlar: [[eworks-hedef-mimari]]; açık konular: [[eworks-acik-konular]].
