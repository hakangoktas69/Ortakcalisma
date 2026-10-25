---
name: eworks-dokumantasyonu
description: Eworks belgeleri nerede — hedef mimari docs/hedef-mimari, geliştirici rehberleri (DDD/TDD, canlı doğrulama, Claude↔Codex) docs/gelistirici-rehberi, eski pilotun analizi docs/arsiv/mevcut-durum, karar kaydı docs/adr; G-NN/M-NN risk kimlikleri arşivde
metadata:
  type: reference
---

Depo yeniden yapılanmasından (2026-10-24) sonra Eworks belgeleri:

- **Hedef mimari** (yeni kodun dayanağı): `docs/hedef-mimari/01…09` — 01 genel bakış + kararlar D1–D36, 02 kurum entegrasyonları, 03 kapasite, 04 dağıtım, 05 yetki/hesap, 06 kod yapısı DDD/TDD, 07 saklama/sharding, 08 depo yeniden yapılanması, 09 Claude↔Codex senkronu.
- **Karar kaydı:** `docs/adr/karar-kaydi.md` (K-01…K-43); uzun gerekçeler `docs/adr/NNNN-*.md`.
- **Geliştirici rehberleri** (2026-10-25): `docs/gelistirici-rehberi/` — `ddd-nedir.md` ve `tdd-nedir.md` kavramsal giriş; `ddd.md` (stratejik → taktiksel → uygulama mimarisi) ve `tdd.md` (iki düzeyli kırmızı/yeşil, döngü, örnekler, başvuru) bugünkü koddan örnekli uygulama rehberleri; `canli-dogrulama.md`, `claude-codex.md`. Ajanlar için özet akış `gelistir` becerisi (`docs/ai/beceriler/gelistir.md`); alt dizin kuralları `packages/contexts`, `packages/kernel`, `packages/feature-registry`, `services/integration`, `supabase`, `apps/*` altındaki `CLAUDE.md`.
- **Eski Eworks pilotunun analizi** (yalnız referans): `docs/arsiv/mevcut-durum/` — `02-mimari/`, `03-gelistirici-rehberi/`, `04-eksikler-ve-riskler/` (risk kimlikleri `G-NN` güvenlik, `M-NN` mimari), `ai/` ve eski bağlam `CLAUDE.eski.md`. Kod: `eski/mert/eworks/entegrasyon-1-tarayici/` (belgelerde `E1/`).
- Eski kodda görünmeyen nokta: eski kullanıcı belgeleri "CAPTCHA'yı kullanıcı girer" der, 21.10 kodu otomatik giriş yapar (G-01). Hedef mimaride otomatik CAPTCHA bilinçli karardır (D6/K-15).

**Why:** Belgeler iki kez yer değiştirdi (`hkazaz/eworks` → `docs/`); eski yolları hatırlayan ekip üyesi ya da eski oturum özetleri yanlış yere bakabilir.
**How to apply:** Eski yol (`hkazaz/eworks/...`, `05-hedef-mimari/...`, `02-mimari/05-mimari-kararlar.md`) görürsen yukarıdaki yeni yere çevir. Kararlar: [[eworks-hedef-mimari]]; açık konular: [[eworks-acik-konular]].
