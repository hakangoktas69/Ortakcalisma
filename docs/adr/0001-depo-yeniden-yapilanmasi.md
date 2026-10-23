# 0001 — Depo yeniden yapılanması

- **Durum:** Kabul, uygulandı (2026-10-24, `yeniden-yapilanma` dalı)
- **Karar verici:** Hakan
- **İlgili:** D28, D32 · K-35, K-39 · [hedef-mimari/08](../hedef-mimari/08-depo-yeniden-yapilanmasi.md), [09](../hedef-mimari/09-yapay-zeka-ajan-baglami.md)

## Bağlam

Ortakcalisma deposunda birden çok proje (Mükellef Takip, Eworks pilotu, analiz belgeleri, kişisel klasörler) yan yana duruyordu. Eworks SaaS olarak DDD/TDD ile yeniden yazılacak (D20–D22); depoyu açan geliştiricinin projenin resmini hemen görmesi istendi (D21). Ekip hafızası ve ajan kancaları Mükellef Takip'e bağlıydı.

## Karar

1. Tüm üst klasörler ve eski kök bağlam dosyaları `git mv` ile `eski/` altına taşınır (geçmiş korunur). Eworks SaaS monoreposu depo kökünde kurulur (D28).
2. Eworks belgeleri `docs/hedef-mimari/` (hedef) ve `docs/arsiv/mevcut-durum/` (eski pilotun analizi) altına; karar kaydı `docs/adr/karar-kaydi.md`'ye taşınır.
3. Ekip hafızası köke (`docs/ai/memory/`) alınır; Eworks ve genel ekip kayıtları uyarlanır, Mükellef Takip'e özgü kayıtlar `eski/mukellef-takip/docs/ai/memory/`'de kalır.
4. Claude ↔ Codex senkronu tek kaynaktan üretimle kurulur (D31): `tools/ajan/senkron.mjs`, git kancaları `tools/git-hooks`.
5. **Mükellef Takip arşivdir** (D32): geliştirme sürmez; CI iş akışı yalnız elle tetiklenir, yolları `eski/mukellef-takip`'e çevrilir.

## Seçenekler

- **Yeni depo açmak:** geçmiş ve açık dallar kopardı; ekip iki depoyu izlemek zorunda kalırdı. Seçilmedi.
- **Eworks'ü bir alt klasörde (`eworks/`) kurmak:** kök yine karışık kalırdı (D21'e aykırı). Seçilmedi.
- **Mükellef Takip'i geliştirmeye devam etmek:** iki ürünü aynı ekip paralel taşıyamaz, kapsamlar örtüşüyor (M-17). Arşiv seçildi.

## Sonuçlar

- `git pull` yalnız izlenen dosyaları taşır: her makinede bir kez `node tools/ajan/eski-yerel-tasi.mjs --uygula` (yerel `.env`, sırlar, `settings.local.json` taşınır; derleme çıktıları silinir; eski `autoMemoryDirectory` ve `core.hooksPath` düzeltilir).
- Taşımadan önce açılmış dallar eski yollardadır; git yeniden adlandırmayı çoğunlukla tanır, çakışmada dal sahibi `eski/` yoluna taşır.
- `eski/mukellef-takip` ayrı proje olarak açılırsa kendi `.claude` kancaları çalışır; kök kancaları yalnız yeni yapıyı yönetir.
- Arşivdeki `CLAUDE.md`/`AGENTS.md` dosyaları `docs/arsiv` altında `*.eski.md` adını alır (ajan bağlamı olarak yüklenmesin diye).
