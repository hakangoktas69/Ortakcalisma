# Durum, açık konular ve sıradaki işler

> İşe başlamadan bu dosyaya bak. Son güncelleme: 2026-10-25. Eski Eworks pilotunun durum ve risk listesi (G-NN, M-NN): [arsiv/mevcut-durum/ai/durum-ve-riskler.md](../arsiv/mevcut-durum/ai/durum-ve-riskler.md).

## Durum

| Alan | Durum |
|---|---|
| Kararlar | D1–D35 alındı ([hedef-mimari/01](../hedef-mimari/01-cok-kiracili-hedef-mimari.md)), karar kaydı K-01…K-42 ([adr/karar-kaydi.md](../adr/karar-kaydi.md)) |
| Eski portalın portu (2026-10-25, Hakan) | Sürüyor, aşama A–H: altyapı → kimlik/ofis → portföy + kurum hesapları → senkron + Python ACL → beyanname → SGK → çalışma alanı → kapanış. Yeşil kapsam: gerçek akışlar; kurumla konuşanlar canlı doğrulamaya kadar kırmızı (D33) |
| SGK (aşama F) | MUHSGK'nın SGK bildirimleri (e-Beyanname içinden): işyeri × ay, durum, hizmet listesinden tekil çalışan sayısı (kişi bilgisi ACL dışına çıkmaz), SGK tahakkuk + hizmet listesi PDF'leri; `social_security.workplace_filings`; e-Bildirge (toplu güncelle: iş türü `gib.muhsgk`) ve SGK kontrol ekranları. Yeşil: 26 düğüm; `sgk.ebildirge.sync` canlı kayıt bekler (D33). SGK'nın kendi sistemleri (işe giriş/çıkış, e-Rapor, iş kazası) bağlanmadı |
| Beyanname + belgeler (aşama E) | Robot aynı GİB oturumunda sözleşme listesi + e-Beyanname (ay ay sorgu, sayfalama, beyanname/tahakkuk PDF'leri, kurum incelemesi kuralı: yalnız Aracılık ve Sorumluluk sözleşmeli mükellef), sahte e-Beyanname, `tax_filing.declarations`, `documents.files` (içerik özetli S3, denetimli indirme, D15 saklama temizliği). Ekranlar: beyanname senkron/liste/CSV/kontrol/belge, kurum incelemesi. Yeşil: 22 işlem/düğüm; `beyanname.senkron.start` canlı kayıt bekler (D33) |
| Senkron + Python ACL (aşama D) | Kurum işi (iş + transactional outbox → RabbitMQ), işçi (outbox taşıyıcı, sonuç uygulayıcı, takılı iş temizliği), Python ACL (Playwright başsız tarayıcı, otomatik güvenlik kodu — ddddocr, Redis GCRA hız sınırı, `*.gib.gov.tr` → sahte GİB yönlendirmesi yalnız demo/test), GİB e-Beyanname sözleşme listesi → firma eşleme/açma, `/firmalar/gib_sozlesmeler`. Yeşil: `firmalar.gib_sozlesmeler.view` (10/107). `firmalar.gib_sozlesmeler.sync` testleri geçer, **canlı GİB kaydı bekler** (D33) |
| Portföy ve kurum hesapları (aşama C) | Firma kartı (ekle/düzenle/arşivle), liste + CSV, sistem genelinde VKN tekilliği (HMAC), kapsam RLS'i, müşavir/firma GİB hesabı (Vault), hash zincirli denetim kaydı. Yeşil: `firmalar.liste.*`, `firmalar.kart.*`, `firmalar.kurum_hesaplari.view_status/edit_credentials` (9/107) |
| Kimlik ve web (aşama B) | `apps/web` Next.js 16 (BFF, nonce'lu CSP, HttpOnly oturum, CSRF), GoTrue girişi, rol şablonları + miraslı yetki, ofis/kullanıcı açma komutu (`hesap-ac`), demo hesabı. Yeşil: `oturum.giris.login` |
| Altyapı (aşama A) | Compose: kontrol düzlemi (Supabase Postgres + GoTrue), 2 shard (Vault), Redis, RabbitMQ, S3 (SeaweedFS), `migrate` görevi; Helm iskeleti (`helm lint` yeşil, kümede koşulmadı); migration çalıştırıcı, `ShardRouter`, pgTAP koşucusu. Testler: `node tools/deploy/yigin.mjs test` |
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

- [x] `apps/web` Next.js kurulumu; `FeatureGate`/`FeatureBadge`; ilk kabul testi (aşama B). `apps/sales` ekranı bekliyor
- [x] Compose yığını ve Helm iskeleti; on-prem Supabase (kontrol düzlemi + 2 shard), RabbitMQ, Redis, S3 (aşama A, 2026-10-25)
- [x] `supabase/migrations` (control/tenant) + pgTAP koşucusu; `ShardRouter` (aşama A)
- [x] `services/integration`: sahte GİB sunucusu; GİB girişi, İVD geçişi, sözleşme listesi modülleri taşındı (aşama D). Beyanname ve SGK modülleri E–F aşamalarında
- [ ] CI: `pnpm features` çıktısının PR'da güncel olduğunun denetimi; pytest sonuçlarının özellik durumuna katılması (pytest yığın testinde koşuyor, JUnit `test-results/pytest.xml`)
