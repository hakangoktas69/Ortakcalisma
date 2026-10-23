# Durum, açık konular ve sıradaki işler

> İşe başlamadan bu dosyaya bak. Son güncelleme: 2026-10-24. Eski Eworks pilotunun durum ve risk listesi (G-NN, M-NN): [arsiv/mevcut-durum/ai/durum-ve-riskler.md](../arsiv/mevcut-durum/ai/durum-ve-riskler.md).

## Durum

| Alan | Durum |
|---|---|
| Kararlar | D1–D32 alındı ([hedef-mimari/01](../hedef-mimari/01-cok-kiracili-hedef-mimari.md)), karar kaydı K-01…K-39 ([adr/karar-kaydi.md](../adr/karar-kaydi.md)) |
| Depo yeniden yapılanması (D28) | **Uygulandı (2026-10-24, `yeniden-yapilanma` dalı)**: tüm eski klasörler `eski/` altında, yeni iskelet kökte. Ekip pull sonrası `node tools/ajan/eski-yerel-tasi.mjs --uygula` çalıştırır |
| Mükellef Takip | **Arşiv** (D32): `eski/mukellef-takip`, CI yalnız elle tetiklenir |
| Kod | Faz 0 iskeleti: `kernel` (TaxId, Period), 12 bağlam paketi (boş), `feature-registry` tam ağaç, `tools/arch`, `tools/features`. Uygulamalar (`apps/*`) ve servisler yalnız iskelet |
| Özellikler | Bugünkü portalın tüm ekranları + hedef ekranlar kayıtta, **hepsi kırmızı** ([ozellik-durumu.md](../ozellik-durumu.md)) |
| Ajan bağlamı | Claude ↔ Codex senkronu (D31) kuruldu: `tools/ajan/senkron.mjs`, git kancaları, ortak hafıza `docs/ai/memory` |

## Açık konular

1. **Hız ve ölçek tutarlılığı:** 500 ofis × 1.505 ≈ 752.500 kurum hesabı; gece penceresinde tam tarama için web serviste ≈ 3.216 istek/dk gerekir. 60 istek/dk toplam başlangıç hızıyla tam tarama ≈ 54 gece ([03 §1a](../hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md)). "60/dk" kapsamları (toplam mı, kurum mu, hesap mı?) ve kurum servis limitleri netleşmeli.
2. **Shard başlangıç donanımı:** öneri kontrol düzlemi + 2 fiziksel shard sunucusu, 16 mantıksal shard ([07 §2.3](../hedef-mimari/07-veri-saklama-ve-sharding.md)).
3. **Bağlama atanmamış portal modülleri:** e-Tebligat, e-Defter, Faturalar, Dilekçeler, Ödeme, Raporlar, Destek ([baglamlar/README.md](../baglamlar/README.md)).
4. **CODEOWNERS:** bağlam başına sahipler belirlenmedi.
5. **Codex proje içi beceri desteği** doğrulanmadı; şimdilik `AGENTS.md`'deki beceri eşlemesi kullanılıyor ([09 §7](../hedef-mimari/09-yapay-zeka-ajan-baglami.md#7-geçiş-58deki-taşıma-adımlarına-eklenir)).

Süren iş: GİB/SGK web servis envanteri ve kurum erişim bilgileri analizi (Hakan). Sonuç gelince [02 §1a](../hedef-mimari/02-kurum-entegrasyon-robotu.md) `integrations` tablosu ve [03 §1a](../hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md) hesapları güncellenir.

## Sıradaki işler (Faz 0, [01 §9](../hedef-mimari/01-cok-kiracili-hedef-mimari.md#9-geliştirme-planı-kaba-23-geliştirici))

- [ ] `apps/web` ve `apps/sales` Next.js kurulumu; `FeatureGate`/`FeatureBadge`; ilk kabul testi
- [ ] Compose profili ve Helm iskeleti; on-prem Supabase (kontrol düzlemi + 2 shard), RabbitMQ, Redis, MinIO
- [ ] `supabase/migrations` ilk şemalar + pgTAP; `ShardRouter`
- [ ] `services/integration` için sahte kurum sunucusu; taşınacak Python modülleri (01 §8)
- [ ] CI: `pnpm features` çıktısının PR'da güncel olduğunun denetimi; pytest/pgTAP sonuçlarının özellik durumuna katılması
