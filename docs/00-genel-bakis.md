<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../README.md) › **Genel bakış**
<!-- /gezinti -->

# Genel bakış

Eworks, mali müşavir ofislerinin kurum (GİB, SGK) verilerini müşavirin ve mükelleflerin kendi hesaplarıyla toplu çektiği çok kiracılı SaaS portaldır. Bu sayfa yeni geliştiricinin okuma sırasını ve belge haritasını verir.

## Okuma sırası (junior)

İlk hafta, bu sırayla. Her belge kısa; bilmediğin terim için [terimler.md](gelistirici-rehberi/terimler.md).

1. [Başlangıç rehberi](gelistirici-rehberi/baslangic.md) — kur, çalıştır, değiştir, test et. Uygulamayı çalıştırıp demo hesabıyla gez.
2. [README](../README.md) — bağlam haritası, bir isteğin akışı, dizin haritası.
3. [ai/vizyon.md](ai/vizyon.md) — ürün kimin için, ne yapar, ne yapmaz.
4. [ai/kurallar.md](ai/kurallar.md) — pazarlıksız kurallar (neden önemli olduklarıyla).
5. [DDD nedir](gelistirici-rehberi/ddd-nedir.md) ve [TDD nedir](gelistirici-rehberi/tdd-nedir.md) — kodun neden böyle düzenlendiği, neden önce test yazıldığı.
6. [Claude Code / Codex ile çalışma](gelistirici-rehberi/claude-codex.md#ajana-iş-verdiğinde-ne-olur-gelistir) — ajana iş verince ne olur.
7. Çalışacağın bağlamın sayfası: [baglamlar/](baglamlar/README.md), sonra `packages/contexts/<ad>/src/index.ts`.

## Okuma sırası (derinleşmek için)

1. [ai/mimari.md](ai/mimari.md), [ai/test.md](ai/test.md) — bileşenler, katmanlar, test katmanları.
2. [ai/durum.md](ai/durum.md) — şu anki durum ve açık konular.
3. [DDD rehberi](gelistirici-rehberi/ddd.md) ve [TDD rehberi](gelistirici-rehberi/tdd.md) — koddan örneklerle uygulama.
4. [hedef-mimari/](hedef-mimari/01-cok-kiracili-hedef-mimari.md) — kararların gerekçesi.

## Belge haritası

| Klasör | İçerik |
|---|---|
| [../deploy/](../deploy/README.md) | Docker Compose ve Kubernetes: servisler, komutlar, ayarlar |
| [hedef-mimari/](hedef-mimari/01-cok-kiracili-hedef-mimari.md) | Kararlar D1–D38 ve gerekçeli ayrıntı: 01 genel, 02 kurum entegrasyonu, 03 kapasite, 04 dağıtım, 05 yetki ve hesap, 06 kaynak kod DDD/TDD, 07 veri saklama ve sharding, 08 depo yeniden yapılanması, 09 ajan bağlamı |
| [adr/](adr/README.md) | Karar kaydı (`K-NN`) ve uzun ADR'ler |
| [baglamlar/](baglamlar/README.md) | Bounded context sayfaları |
| [ozellik-durumu.md](ozellik-durumu.md) | Modül → sayfa → işlem, kırmızı/yeşil (üretilir) |
| [ai/](ai/vizyon.md) | Ajan bağlamı; [ai/memory/](ai/memory/MEMORY.md) ekip hafızası; `ai/beceriler/` beceri kaynakları |
| [gelistirici-rehberi/](gelistirici-rehberi/baslangic.md) | [Başlangıç](gelistirici-rehberi/baslangic.md), [terimler](gelistirici-rehberi/terimler.md); [DDD](gelistirici-rehberi/ddd.md) ve [TDD](gelistirici-rehberi/tdd.md) uygulama rehberleri (koddan örneklerle); Claude Code ve Codex ile çalışma, ekip senkronu; [canlı GİB doğrulaması](gelistirici-rehberi/canli-dogrulama.md) |

## Arşiv (yalnız referans)

Yeni geliştirme yapılmaz; klasör düzeni: [eski/README.md](../eski/README.md).

### eski/eworks

| Belge | İçerik |
|---|---|
| [arsiv/mevcut-durum/](arsiv/mevcut-durum/README.md) | Eski Eworks pilotunun analizi; kaynak kod `eski/mert/eworks/` |

### eski/mukellef-portal

Mükellef Takip (D32, arşiv): `eski/hakan/mukellef-takip/`. Satış portalı deseni (ADR 0009) → `apps/sales`, DDD/test düzeni → `packages/contexts`.

| Belge | İçerik |
|---|---|
| [README](../eski/hakan/mukellef-takip/README.md) · [belge dizini](../eski/hakan/mukellef-takip/docs/README.md) | Yapı, çalıştırma; junior/senior/mimar okuma yolları |
| [00 genel bakış](../eski/hakan/mukellef-takip/docs/00-genel-bakis.md) | Aktörler, sistem bağlamı (C4) |
| [01 stratejik tasarım](../eski/hakan/mukellef-takip/docs/01-stratejik-tasarim/01-is-alani-ve-alt-alanlar.md) | İş alanı, [ortak dil](../eski/hakan/mukellef-takip/docs/01-stratejik-tasarim/02-ortak-dil.md), [bağlam haritası](../eski/hakan/mukellef-takip/docs/01-stratejik-tasarim/03-baglam-haritasi.md), [iş akışları](../eski/hakan/mukellef-takip/docs/01-stratejik-tasarim/04-is-akislari.md) |
| [02 bağlamlar](../eski/hakan/mukellef-takip/docs/02-baglamlar/README.md) | 13 bounded context sayfası |
| [03 taktiksel tasarım](../eski/hakan/mukellef-takip/docs/03-taktiksel-tasarim/01-katmanlar.md) | Katmanlar, yapı taşları, olaylar ve outbox, tutarlılık, çapraz kesen konular, taktik borç |
| [04 mimari](../eski/hakan/mukellef-takip/docs/04-mimari/01-calisma-zamani.md) | Çalışma zamanı, [veri modeli](../eski/hakan/mukellef-takip/docs/04-mimari/02-veri-modeli.md), [güvenlik mimarisi](../eski/hakan/mukellef-takip/docs/04-mimari/03-guvenlik-mimarisi.md) |
| [05 geliştirici rehberi](../eski/hakan/mukellef-takip/docs/05-gelistirici-rehberi/01-ilk-gun.md) | İlk gün, tarifler, kod inceleme, tuzaklar, Claude Code |
| [adr/](../eski/hakan/mukellef-takip/docs/adr/0001-moduler-monolit.md) | ADR 0001–0009 (modüler monolit … [satış modülü](../eski/hakan/mukellef-takip/docs/adr/0009-satis-modulu.md)) |
| [ai/](../eski/hakan/mukellef-takip/docs/ai/architecture.md) | Kısa ajan bağlamı: mimari, bağlamlar, kurallar, [güvenlik/KVKK](../eski/hakan/mukellef-takip/docs/ai/security-kvkk.md), yol haritası |
| [satis/](../eski/hakan/mukellef-takip/satis/README.md) | Satış modülü (api + web) |

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../README.md) › **Genel bakış**
<!-- /gezinti -->
