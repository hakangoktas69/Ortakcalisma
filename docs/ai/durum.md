# Durum, açık konular ve sıradaki işler

> İşe başlamadan bu dosyaya bak. Son güncelleme: 2026-10-26. Eski Eworks pilotunun durum ve risk listesi (G-NN, M-NN): [arsiv/mevcut-durum/ai/durum-ve-riskler.md](../arsiv/mevcut-durum/ai/durum-ve-riskler.md).

## Durum

| Alan | Durum |
|---|---|
| Kararlar | D1–D37 alındı ([hedef-mimari/01](../hedef-mimari/01-cok-kiracili-hedef-mimari.md)), karar kaydı K-01…K-44 ([adr/karar-kaydi.md](../adr/karar-kaydi.md)) |
| Eski portalın portu (2026-10-25, Hakan) | **Tamamlandı (aşama A–H)**: eski Eworks portalının çalışan kısımları (giriş, firmalar, kurum hesapları, GİB sözleşmeleri, e-Beyanname + PDF, MUHSGK/SGK, görev/not) yeni yapıda, gerçek akışlarla ve testleriyle. Uygulama: `node tools/deploy/yigin.mjs up` → `http://localhost:8080`. Kurumla konuşan 3 işlem canlı doğrulama bekler: [canli-dogrulama.md](../gelistirici-rehberi/canli-dogrulama.md) |
| Çalışma alanı (aşama G) | Görevler (oluştur, ata, durum, kapat; iyimser kilit; atama/kapatma denetimli), firma notları (eklenir, değiştirilmez), ana sayfa sayaçları (yetki + kapsamla) ve son kurum işleri. Yeşil: 36 düğüm |
| SGK (aşama F) | MUHSGK'nın SGK bildirimleri (e-Beyanname içinden): işyeri × ay, durum, hizmet listesinden tekil çalışan sayısı (kişi bilgisi ACL dışına çıkmaz), SGK tahakkuk + hizmet listesi PDF'leri; `social_security.workplace_filings`; e-Bildirge (toplu güncelle: iş türü `gib.muhsgk`) ve SGK kontrol ekranları. Yeşil: 26 düğüm; `sgk.ebildirge.sync` canlı kayıt bekler (D33). SGK'nın kendi sistemleri (işe giriş/çıkış, e-Rapor, iş kazası) bağlanmadı |
| Beyanname + belgeler (aşama E) | Robot aynı GİB oturumunda sözleşme listesi + e-Beyanname (ay ay sorgu, sayfalama, beyanname/tahakkuk PDF'leri, kurum incelemesi kuralı: yalnız Aracılık ve Sorumluluk sözleşmeli mükellef), sahte e-Beyanname, `tax_filing.declarations`, `documents.files` (içerik özetli S3, denetimli indirme, D15 saklama temizliği). Ekranlar: beyanname senkron/liste/CSV/kontrol/belge, kurum incelemesi. Yeşil: 22 işlem/düğüm; `beyanname.senkron.start` canlı kayıt bekler (D33) |
| Senkron + Python ACL (aşama D) | Kurum işi (iş + transactional outbox → RabbitMQ), işçi (outbox taşıyıcı, sonuç uygulayıcı, takılı iş temizliği), Python ACL (Playwright başsız tarayıcı, otomatik güvenlik kodu — ddddocr, Redis GCRA hız sınırı, `*.gib.gov.tr` → sahte GİB yönlendirmesi yalnız demo/test), GİB e-Beyanname sözleşme listesi → firma eşleme/açma, `/firmalar/gib_sozlesmeler`. Yeşil: `firmalar.gib_sozlesmeler.view` (10/107). `firmalar.gib_sozlesmeler.sync` testleri geçer, **canlı GİB kaydı bekler** (D33) |
| Portföy ve kurum hesapları (aşama C) | Firma kartı (ekle/düzenle/arşivle), liste + CSV, sistem genelinde VKN tekilliği (HMAC), kapsam RLS'i, müşavir/firma GİB hesabı (Vault), hash zincirli denetim kaydı. Yeşil: `firmalar.liste.*`, `firmalar.kart.*`, `firmalar.kurum_hesaplari.view_status/edit_credentials` (9/107) |
| Kimlik ve web (aşama B) | `apps/web` Next.js 16 (BFF, nonce'lu CSP, HttpOnly oturum, CSRF), GoTrue girişi, rol şablonları + miraslı yetki, ofis/kullanıcı açma komutu (`hesap-ac`), demo hesabı. Yeşil: `oturum.giris.login` |
| Altyapı (aşama A) | Compose: kontrol düzlemi (Supabase Postgres + GoTrue), 2 shard (Vault), Redis, RabbitMQ, S3 (SeaweedFS), `migrate` görevi; Helm iskeleti (`helm lint` yeşil, kümede koşulmadı); migration çalıştırıcı, `ShardRouter`, pgTAP koşucusu. Testler: `node tools/deploy/yigin.mjs test` |
| Depo yeniden yapılanması (D28) | **Uygulandı (2026-10-24, `yeniden-yapilanma` dalı)**: tüm eski klasörler `eski/` altında, yeni iskelet kökte. Ekip pull sonrası `node tools/ajan/eski-yerel-tasi.mjs --uygula` çalıştırır |
| Mükellef Takip | **Arşiv** (D32): `eski/hakan/mukellef-takip` (2026-10-25'te `eski/mukellef-takip`'ten taşındı; diğer makinelerde `node tools/ajan/eski-yerel-tasi.mjs --uygula` + `npm install`), CI yalnız elle tetiklenir |
| Kod | Dolu bağlamlar: identity-access, sales (hesap açma), portfolio, credentials, audit, sync, tax-filing, documents, social-security, workspace. Boş: organization (yönetim ekranları), notifications. `apps/web`, `apps/worker`, `services/integration` çalışır; `apps/sales` ekranı yok |
| Özellikler | 36 düğüm yeşil (gerçek akış + kabul testi); kalanlar kırmızı: canlı doğrulama bekleyen 3 işlem, e-Tebligat, e-Defter, fatura, dilekçe, ödeme, rapor, yönetim, SGK sistemleri, satış portalı ([ozellik-durumu.md](../ozellik-durumu.md)) |
| Ajan bağlamı | Claude ↔ Codex senkronu (D31) kuruldu: `tools/ajan/senkron.mjs`, git kancaları, ortak hafıza `docs/ai/memory`. DDD/TDD yönlendirmesi (2026-10-25): `gelistir` becerisi, rehberler (`docs/gelistirici-rehberi/{ddd,tdd}*.md`), alt dizin `CLAUDE.md`'leri; junior kullanıcı varsayımıyla üç aşamalı `gelistir` akışı (D37/K-44, 2026-10-26: anla → planla/uygula → tutarlılık, fonksiyonel, dört ekran görsel/erişilebilirlik/UX doğrulaması; iş dalı + ortak dal kancası, PR şablonu, hassas alan uyarısı, bağımsız inceleme, axe-core) (`packages/contexts`, `packages/kernel`, `packages/feature-registry`, `services/integration`, `supabase`, `apps/*`); bekçiler: kapsam eşiği `pnpm verify`/CI'da zorunlu (domain + application + kernel), yetki anahtarı rota taraması testi |

## Açık konular

1. **Hız ve ölçek tutarlılığı:** 500 ofis × 1.505 ≈ 752.500 kurum hesabı; gece penceresinde tam tarama için web serviste ≈ 3.216 istek/dk gerekir. 60 istek/dk toplam başlangıç hızıyla tam tarama ≈ 54 gece ([03 §1a](../hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md)). "60/dk" kapsamları (toplam mı, kurum mu, hesap mı?) ve kurum servis limitleri netleşmeli.
2. **Shard başlangıç donanımı:** öneri kontrol düzlemi + 2 fiziksel shard sunucusu, 16 mantıksal shard ([07 §2.3](../hedef-mimari/07-veri-saklama-ve-sharding.md)).
3. **Bağlama atanmamış portal modülleri:** e-Tebligat, e-Defter, Faturalar, Dilekçeler, Ödeme, Raporlar, Destek ([baglamlar/README.md](../baglamlar/README.md)).
4. **GitHub dal koruması yok:** kod sahibi belirlendi (`@hkazaz`, `.github/CODEOWNERS` `HASSAS_ALANLAR`'dan üretilir, D37), ama `main`'de PR + CI + kod sahibi onayı zorunluluğu GitHub ayarlarında açılmadı; `dev`'de doğrudan push engeli yok. Yerel pre-commit kancası `--no-verify` ile ve çakışmalı birleşmede sahnelenen ek değişiklikle aşılabilir. Ayarı depo yöneticisi yapar.
5. **Codex proje içi beceri desteği** doğrulanmadı; şimdilik `AGENTS.md`'deki beceri eşlemesi kullanılıyor ([09 §7](../hedef-mimari/09-yapay-zeka-ajan-baglami.md#7-geçiş-58deki-taşıma-adımlarına-eklenir)).
6. **Canlı GİB doğrulaması:** `firmalar.gib_sozlesmeler.sync`, `beyanname.senkron.start`, `sgk.ebildirge.sync` sahte GİB'e karşı geçiyor; canlı koşu Hakan'ın hesabıyla ([canli-dogrulama.md](../gelistirici-rehberi/canli-dogrulama.md)). Canlı GİB güvenlik kodunda ddddocr başarısı bilinmiyor (sahte sunucuda 30/30).
7. **Bağlamlar arası okuma birleşimleri:** tax-filing, social-security, workspace sorguları firma unvanı için `portfolio.firms` ile birleşir (kural 5'ten sapma). Okuma modeline ya da portfolio API'sine taşınmalı.
8. **Yönetim ekranları yok:** personel ataması, kişiye özel izin, ofis kullanıcısı daveti, mükellef kullanıcıları — şimdilik yalnız `hesap-ac` komutu.
9. **ACL kapsam eşiği zorlanmıyor:** "ACL ayrıştırıcıları %90" kuralı için `services/integration`'da pytest kapsam ölçümü yok (TS tarafı `pnpm verify`/CI'da zorlanıyor).
10. **Keşif kodu ifadesi onay bekliyor:** [tdd.md §5.3](../gelistirici-rehberi/tdd.md#53-netleşmemiş-iş-ve-keşif) "deneme kodu olduğu gibi birleştirilmez" ifadesi kuraldan çıkarım; ekip onayı ya da çıkarılması bekleniyor.
11. **Web/BFF'te operasyon logu yok (2026-10-26):** ACL JSON olay logu (`gunluk`), işçi `console.error` kullanıyor; `apps/web`'de ortak log yardımcısı yok. Örnek: `apps/web/src/app/api/gorevler/route.ts` (ve benzer `notlar`) her hatayı (veritabanı kesintisi dahil) "Firma bulunamadı" 404'üne katlıyor ve loglamıyor ([kurallar](kurallar.md#kod) "Hata ve log"). Tek log yardımcısı (biçim, kişisel veri süzgeci) ve bu uçların düzeltilmesi bekliyor.
12. **Ekranda VKN/TCKN maskeleme uygulanmıyor (2026-10-26):** [kurallar](kurallar.md#pazarlıksız-kurallar) 8 "ekranda maskelenir (`maskTaxId`)" diyor, ama `maskTaxId` hiçbir ekranda kullanılmıyor; firma listesi ve kartı tam numarayı gösteriyor. Müşavirin kendi portföyünde tam numara iş gereği olabilir: hangi ekranda, hangi role maskeli gösterileceği kararı bekliyor.

Süren iş: GİB/SGK web servis envanteri ve kurum erişim bilgileri analizi (Hakan). Sonuç gelince [02 §1a](../hedef-mimari/02-kurum-entegrasyon-robotu.md) `integrations` tablosu ve [03 §1a](../hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md) hesapları güncellenir.

## Sıradaki işler (Faz 0, [01 §9](../hedef-mimari/01-cok-kiracili-hedef-mimari.md#9-geliştirme-planı-kaba-23-geliştirici))

- [x] `apps/web` Next.js kurulumu; `FeatureGate`/`FeatureBadge`; ilk kabul testi (aşama B). `apps/sales` ekranı bekliyor
- [x] Compose yığını ve Helm iskeleti; on-prem Supabase (kontrol düzlemi + 2 shard), RabbitMQ, Redis, S3 (aşama A, 2026-10-25)
- [x] `supabase/migrations` (control/tenant) + pgTAP koşucusu; `ShardRouter` (aşama A)
- [x] `services/integration`: sahte GİB sunucusu; GİB girişi, İVD geçişi, sözleşme listesi modülleri taşındı (aşama D). Beyanname ve SGK modülleri E–F aşamalarında
- [ ] CI: `pnpm features` çıktısının PR'da güncel olduğunun denetimi; pytest sonuçlarının özellik durumuna katılması (pytest yığın testinde koşuyor, JUnit `test-results/pytest.xml`)
- [x] Eski portalın portu, aşama A–H (2026-10-25)
- [ ] **Acil (2026-10-26):** `next` 16.4.0 → 16.4.1 — `pnpm audit`: 2 kritik (kimlik doğrulamasız uzaktan kod çalıştırma: görsel optimizasyonu + SVG, `use cache`), 1 yüksek (server action DoS)
- [ ] Canlı GİB doğrulaması (Hakan, açık konu 6)
- [ ] Yönetim ekranları, `apps/sales`, e-Tebligat, SGK sistemleri, bildirimler
