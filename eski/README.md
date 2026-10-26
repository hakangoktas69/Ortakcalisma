# eski/ — yeniden yapılanma öncesi depo (arşiv / referans)

24.10.2026'da (karar D28 / K-35) Ortakcalisma'daki tüm klasörler buraya taşındı. Eworks SaaS monoreposu artık **depo kökündedir**: [../README.md](../README.md). Taşıma planı ve gerekçesi: [../docs/hedef-mimari/08-depo-yeniden-yapilanmasi.md](../docs/hedef-mimari/08-depo-yeniden-yapilanmasi.md).

Bu klasörde yeni geliştirme yapılmaz. Dosyalar git geçmişiyle birlikte (`git log --follow`) taşındı.

| Klasör | Ne | Yeni yapıdaki karşılığı |
|---|---|---|
| `hakan/mukellef-takip/` | Mükellef Takip (NestJS + Next.js + Chrome eklentisi); 25.10.2026'da `eski/mukellef-takip/`'ten buraya taşındı. **Arşiv** (D32): CI yalnız elle tetiklenir (`.github/workflows/mukellef-takip.yml`). Kendi `CLAUDE.md`, `docs/ai`, `.claude` dosyaları yerinde; ayrı proje olarak açılırsa kancaları çalışır | Satış portalı deseni (ADR 0009) → `apps/sales`; DDD/test düzeni → `packages/contexts` |
| `mert/eworks/` | Eworks yerel pilotu, ilk sürüm (Eworks 1, `entegrasyon-1-tarayici`: tek dosya portal, Python/Playwright robotu, Supabase). Yeniden yapılandırılan uygulamanın kaynağı (D29: veri taşıma yok) | `apps/web`, `services/integration`, `supabase/` |
| `mert/eworks/<kısa-sha>-<commit adı>/` | Eworks 2 (Mert, 23.10.2026, `dev`): her commit'in modül kodu kendi dizininde, `COMMIT.md` ile (26.10.2026'da aktarıldı). [d8326fb](mert/eworks/d8326fb-eworks-ikinci-entegrasyonunu-ve-ekip-hafizasini-ayri-dizinde-paylas/COMMIT.md): ikinci entegrasyon (aynı GİB oturumunda HTTP taşıma) + pilot ekip hafızası; [7b48e1f](mert/eworks/7b48e1f-eworks-beyanname-ve-bildirge-tablolarinda-detay-dugmesini-ekrana-sigdir/COMMIT.md): Detay düğmesi; [2799eff](mert/eworks/2799eff-ilk-eworks-surumunu-ayri-arsivle-ve-ana-ikinci-surumde-e-defter-ekranini-hazirla/COMMIT.md): ilk sürümün ayrılması + e-Defter ekranı. Kurum erişimi D38 ile yeni yapıya taşınıyor | `services/integration/.../transports/service` (D38) |
| `hkazaz/` | Analiz belgeleri (`*-analiz.md`), Docker denemeleri (`docker/`). Eworks dokümantasyonu buradan taşındı | `docs/hedef-mimari/`, `docs/arsiv/mevcut-durum/` |
| `hakan/`, `yunus/` | Kişisel çalışma klasörleri (`hakan/` Mükellef Takip'i de barındırır) | — |
| `karsilastirma-fonksiyonel.md`, `karsilastirma-gorsel.md` | Mükellef Takip, Eworks 1 (ilk entegrasyon) ve Eworks 2 (`dev` dalındaki ikinci entegrasyon) için işlev ve görsel karşılaştırma (26.10.2026) | — |
| `CLAUDE.md`, `AGENTS.md`, `README-eski-kok.md` | Eski kök bağlam ve klasör tablosu (eski kök `README.md`, bu dosyayla çakışmasın diye yeniden adlandırıldı) | Kök `CLAUDE.md`, `AGENTS.md`, `README.md` |

## Pull sonrası her makinede bir kez

`git pull` yalnız izlenen dosyaları taşır. `.env`, `infra/docker/secrets/`, `.claude/settings.local.json`, `node_modules` gibi yerel dosyalar eski yerlerinde kalır. Depo kökünden:

```bash
node tools/ajan/eski-yerel-tasi.mjs            # ne yapılacağını listeler
node tools/ajan/eski-yerel-tasi.mjs --uygula   # taşır, derleme çıktılarını siler, eski ayarları düzeltir
```

Ardından Claude Code / Codex'te yeni oturum açın. Mükellef Takip'i çalıştıracaksanız yeni yerinde bağımlılıkları kurun (`cd eski/hakan/mukellef-takip && npm install`); npm workspace bağlantıları mutlak yol tuttuğu için klasör taşınınca yeniden kurulmalıdır.

## Taşımadan önce açılmış dallar

Eski yollardaki (`mukellef-takip/...`, `mert/...`) bir dal birleştirilirken git yeniden adlandırmayı çoğunlukla kendiliğinden tanır. Çakışma çıkarsa dalın sahibi değişikliğini `eski/` altındaki yeni yola taşır. Rebase değil merge: kişisel dalda `node tools/ajan/birlestir.mjs guncelle`, çakışmayı orada çöz, doğrula, sonra `birlestir.mjs dev` (D37). Pull sonrası adımlar ve konum çakışmasının çözümü: ekip hafızası `docs/ai/memory/eworks-yeniden-yapilanma.md`.
