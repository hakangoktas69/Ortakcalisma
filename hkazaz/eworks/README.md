# Eworks — yazılım dokümantasyonu

> Kaynak: `mert/eworks` (repo commit `51e2cd1`, kaynak tarihi 21.10.2026 — `SOURCE-MANIFEST.json`). Hazırlanma: 23.10.2026.
> Kod bu klasörde **değil**, `mert/eworks/` altındadır (sahibi Mert). Bu klasör yalnızca belge ve Claude/Codex bağlamı içerir.
> Belgelerde `E1/` kısaltması = `mert/eworks/entegrasyon-1-tarayici/`.

Eworks; mali müşavirin GİB'deki e-Beyanname sözleşmelerini, beyanname listelerini, beyanname/tahakkuk PDF'lerini ve MUHSGK içindeki SGK belgelerini **müşavirin kendi bilgisayarında çalışan bir tarayıcı robotu** ile okuyup Supabase üzerinde tutulan tek sayfalık bir portala aktaran yerel pilottur.

## Seviyeler

| # | Belge | Kime öncelikli |
|---|---|---|
| 0 | [00-genel-bakis.md](00-genel-bakis.md) — ne, kimin için, hangi parçalar | Herkes |
| 1 | [01-yonetici-ozeti.md](01-yonetici-ozeti.md) — olgunluk, riskler, karar gerektiren konular | CTO |
| 2 | [02-mimari/01-sistem-mimarisi.md](02-mimari/01-sistem-mimarisi.md) — bileşenler, çalışma zamanı, teknoloji | Mimar, Senior |
| 2 | [02-mimari/02-bilesen-iliskileri.md](02-mimari/02-bilesen-iliskileri.md) — projeler arası akışlar (sıra diyagramları) | Mimar, Senior |
| 2 | [02-mimari/03-veri-modeli.md](02-mimari/03-veri-modeli.md) — tablolar, JSONB yükü, Storage, Vault | Senior, Mimar |
| 2 | [02-mimari/04-guvenlik-mimarisi.md](02-mimari/04-guvenlik-mimarisi.md) — mevcut kontroller | Mimar, CTO |
| 2 | [02-mimari/05-mimari-kararlar.md](02-mimari/05-mimari-kararlar.md) — geriye dönük karar kayıtları | Mimar |
| 3 | [03-gelistirici-rehberi/01-ilk-gun.md](03-gelistirici-rehberi/01-ilk-gun.md) — kurulum, çalıştırma | Junior |
| 3 | [03-gelistirici-rehberi/02-kod-haritasi.md](03-gelistirici-rehberi/02-kod-haritasi.md) — hangi dosya ne yapar | Junior, Senior |
| 3 | [03-gelistirici-rehberi/03-tarifler.md](03-gelistirici-rehberi/03-tarifler.md) — sık değişiklikler adım adım | Senior |
| 3 | [03-gelistirici-rehberi/04-test.md](03-gelistirici-rehberi/04-test.md) — testler ve sınırları | Junior, Senior |
| 3 | [03-gelistirici-rehberi/05-tuzaklar.md](03-gelistirici-rehberi/05-tuzaklar.md) — bilinen tuzaklar | Herkes |
| 4 | [04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md](04-eksikler-ve-riskler/01-mimari-yapisal-eksikler.md) | Mimar, CTO |
| 4 | [04-eksikler-ve-riskler/02-guvenlik-riskleri.md](04-eksikler-ve-riskler/02-guvenlik-riskleri.md) | Mimar, CTO, Senior |
| 4 | [04-eksikler-ve-riskler/03-iyilestirme-plani.md](04-eksikler-ve-riskler/03-iyilestirme-plani.md) — önceliklendirilmiş yol haritası | CTO, Mimar |
| 5 | [05-hedef-mimari/01-cok-kiracili-hedef-mimari.md](05-hedef-mimari/01-cok-kiracili-hedef-mimari.md) — **hedef**: SaaS, ofis → müşavir → mükellef, kararlar D1–D10, Next.js BFF, veri modeli, geçiş planı | CTO, Mimar, Senior |
| 5 | [05-hedef-mimari/02-kurum-entegrasyon-robotu.md](05-hedef-mimari/02-kurum-entegrasyon-robotu.md) — kurum entegrasyonları: web servis birincil, robot yedek; otomatik CAPTCHA, dakikalık istek sınırı, gece planlayıcı, SGK, PDF saklama | Mimar, Senior |
| 5 | [05-hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md](05-hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md) — DDD bounded context'ler, monorepo dizinleri, katman kuralları, TDD, kırmızı/yeşil özellik işaretleme | Junior, Senior, Mimar |
| 5 | [05-hedef-mimari/07-veri-saklama-ve-sharding.md](05-hedef-mimari/07-veri-saklama-ve-sharding.md) — 10 yıl saklama, kontrol düzlemi + kiracı shard'ları, zamana göre bölümleme | Mimar, CTO, DevOps |
| 5 | [05-hedef-mimari/08-depo-yeniden-yapilanmasi.md](05-hedef-mimari/08-depo-yeniden-yapilanmasi.md) — `eski/` + yeni kök, satış portalı, hafıza/kanca yolları (plan) | Herkes |
| 5 | [05-hedef-mimari/09-yapay-zeka-ajan-baglami.md](05-hedef-mimari/09-yapay-zeka-ajan-baglami.md) — Claude ↔ Codex paylaşılan hafıza ve karşılıklı otomatik senkron | Herkes |
| 5 | [05-hedef-mimari/05-yetki-ve-hesap-modeli.md](05-hedef-mimari/05-yetki-ve-hesap-modeli.md) — müşavir–mükellef ilişkisi, hiyerarşik sayfa/işlem yetkisi, hesap kullanım izni, mükellef onayı | Mimar, Senior, CTO |
| 5 | [05-hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md](05-hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md) — istek bütçesi kapasite formülü, servis bazında tutumluluk kuralları | Mimar, CTO, DevOps |
| 5 | [05-hedef-mimari/04-dagitim-compose-kubernetes.md](05-hedef-mimari/04-dagitim-compose-kubernetes.md) — aynı imajlarla Compose veya Kubernetes, profiller | DevOps, Mimar |
| AI | [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md), [ai/](ai/) — kodlama ajanı bağlamı | Claude Code / Codex |

## Okuma yolları

- **Junior yazılımcı:** 00 → 03/01 → 03/02 → 03/04 → 03/05. İlk hafta kod değiştirmeden önce `02-bilesen-iliskileri`'ndeki "sözleşme güncelleme" akışını uçtan uca izleyin.
- **Senior yazılımcı:** 00 → 02/01 → 02/02 → 02/03 → 03/03 → 03/05 → 04/02.
- **Yazılım mimarı:** 00 → 02 (tümü) → 04 (tümü). Mükellef Takip ile ilişki için ayrıca [../mert-technical-analiz.md](../mert-technical-analiz.md) §9.
- **CTO:** 01 → 04/03 → 04/02 (yalnızca "Kritik/Yüksek" satırları).

## İlgili belgeler (bu klasör dışında)

- [../mert-executive-analiz.md](../mert-executive-analiz.md), [../mert-technical-analiz.md](../mert-technical-analiz.md) — 19.10.2026 (`bb9aaa4`) tarihli önceki analiz. O tarihte OCR pasifti; 21.10 sürümünde otomatik giriş eklendi (bkz. [G-01](04-eksikler-ve-riskler/02-guvenlik-riskleri.md#g-01)).
- [../docker/README.md](../docker/README.md) — Eworks'ü yerel Supabase + Docker ile çalıştırma denemesi.
- Kaynakta mevcut kullanıcı belgeleri: `E1/Eworks-Portal/{Kullanim,GIB-Canli-Akis,Supabase-Kullanim,Supabase-GIB-Hesap-Kurulum}.md`, `mert/eworks/{README,VALIDATION}.md`.

## Belgeyi güncel tutma

Kod `mert/eworks` altında değiştiğinde: başlıktaki commit/kaynak tarihini güncelleyin, `04-eksikler-ve-riskler` tablolarındaki **Durum** sütununu işleyin, değişen satır numaralarını düzeltin. Satır numaraları `51e2cd1` içindir; kayarsa dosya + fonksiyon adı esastır.
