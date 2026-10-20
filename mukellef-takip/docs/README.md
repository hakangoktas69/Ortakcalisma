# Mükellef Takip — Geliştirici Belgeleri

Bu dizin sistemi **yukarıdan aşağıya** anlatır: önce *ne* ve *neden* (iş alanı, stratejik tasarım), sonra *nasıl bölündüğü* (bounded context'ler, mimari), en sonda *nasıl kodlandığı* (taktiksel tasarım, tarifler). Her belge bir üst seviyeye bağlanır; aşağı indikçe koda yaklaşır ve dosya yollarıyla biter.

```
Seviye 0  Genel bakış ............ sistem ne yapar, kimler kullanır, hangi parçalardan oluşur
Seviye 1  Stratejik tasarım ...... iş alanı, alt alanlar, ortak dil, bağlam haritası, iş akışları
Seviye 2  Bounded context'ler .... 13 bağlamın her biri: sorumluluk, model, kurallar, uçlar, olaylar
Seviye 3  Taktiksel tasarım ...... katmanlar, yapı taşları, olaylar/outbox, tutarlılık, çapraz kesen konular
Seviye 4  Mimari ve işletim ....... çalışma zamanı, veri modeli, güvenlik mimarisi, dağıtım
Seviye 5  Geliştirici rehberi ..... ilk gün, tarifler, kod inceleme listesi, tuzaklar
```

## İçindekiler

| # | Belge | Kime öncelikli |
|---|---|---|
| 0 | [Genel bakış](00-genel-bakis.md) | herkes |
| 1.1 | [İş alanı ve alt alanlar](01-stratejik-tasarim/01-is-alani-ve-alt-alanlar.md) | herkes |
| 1.2 | [Ortak dil (ubiquitous language)](01-stratejik-tasarim/02-ortak-dil.md) | herkes |
| 1.3 | [Bağlam haritası ve ilişki kalıpları](01-stratejik-tasarim/03-baglam-haritasi.md) | senior, mimar |
| 1.4 | [Temel iş akışları](01-stratejik-tasarim/04-is-akislari.md) | herkes |
| 2 | [Bounded context kataloğu](02-baglamlar/README.md) — 13 bağlam | herkes (kendi bağlamı) |
| 3.1 | [Katmanlar ve bağımlılık kuralları](03-taktiksel-tasarim/01-katmanlar.md) | junior, senior |
| 3.2 | [Taktiksel yapı taşları](03-taktiksel-tasarim/02-yapi-taslari.md) | junior, senior |
| 3.3 | [Domain olayları ve outbox](03-taktiksel-tasarim/03-olaylar-ve-outbox.md) | senior, mimar |
| 3.4 | [Tutarlılık, transaction ve eşzamanlılık](03-taktiksel-tasarim/04-tutarlilik.md) | senior, mimar |
| 3.5 | [Çapraz kesen konular (kiracılık, kripto, denetim, kimlik)](03-taktiksel-tasarim/05-capraz-kesen-konular.md) | herkes |
| 3.6 | [Taktik borç ve iyileştirme listesi](03-taktiksel-tasarim/06-taktik-borc.md) | senior, mimar |
| 4.1 | [Çalışma zamanı ve dağıtım](04-mimari/01-calisma-zamani.md) | senior, mimar |
| 4.2 | [Veri modeli](04-mimari/02-veri-modeli.md) | senior, mimar |
| 4.3 | [Güvenlik mimarisi](04-mimari/03-guvenlik-mimarisi.md) | herkes |
| 5.1 | [İlk gün (kurulum ve ilk değişiklik)](05-gelistirici-rehberi/01-ilk-gun.md) | junior |
| 5.2 | [Tarifler: uç, kural, olay, context, sayfa eklemek](05-gelistirici-rehberi/02-tarifler.md) | junior, senior |
| 5.3 | [Kod inceleme kontrol listesi](05-gelistirici-rehberi/03-kod-inceleme.md) | senior |
| 5.4 | [Tuzaklar ve sık sorular](05-gelistirici-rehberi/04-tuzaklar.md) | herkes |
| 5.5 | [Claude Code ve ekip hafızası](05-gelistirici-rehberi/05-claude-code.md) | herkes |
| — | [Mimari karar kayıtları (ADR)](adr/) | senior, mimar |
| — | [Claude / ekip bağlamı](ai/) — kısa, kural odaklı özet | herkes |
| — | [Ekip hafızası](ai/memory/MEMORY.md) — Claude'un öğrendikleri, git'te paylaşılır | herkes |

## Rolüne göre okuma yolu

**Junior geliştirici (ilk hafta)**
1. [Genel bakış](00-genel-bakis.md) → [Ortak dil](01-stratejik-tasarim/02-ortak-dil.md) → [Temel iş akışları](01-stratejik-tasarim/04-is-akislari.md)
2. [İlk gün](05-gelistirici-rehberi/01-ilk-gun.md) — kurulum, demo veri, ilk küçük değişiklik
3. Çalışacağın bağlamın sayfası ([katalog](02-baglamlar/README.md)) + [Katmanlar](03-taktiksel-tasarim/01-katmanlar.md)
4. [Tarifler](05-gelistirici-rehberi/02-tarifler.md) ve [Tuzaklar](05-gelistirici-rehberi/04-tuzaklar.md) — iş yaparken açık tut

**Senior geliştirici**
1. Junior yolunun 1. adımı, ardından [Bağlam haritası](01-stratejik-tasarim/03-baglam-haritasi.md)
2. Taktiksel tasarımın tamamı (3.1–3.6) — özellikle [olaylar/outbox](03-taktiksel-tasarim/03-olaylar-ve-outbox.md) ve [tutarlılık](03-taktiksel-tasarim/04-tutarlilik.md)
3. [Kod inceleme listesi](05-gelistirici-rehberi/03-kod-inceleme.md), [test stratejisi](ai/testing.md)
4. [ADR'ler](adr/) — neden böyle olduğunu bilmeden değiştirme

**Mimar**
1. [Genel bakış](00-genel-bakis.md), [İş alanı ve alt alanlar](01-stratejik-tasarim/01-is-alani-ve-alt-alanlar.md), [Bağlam haritası](01-stratejik-tasarim/03-baglam-haritasi.md)
2. [Mimari (4.x)](04-mimari/01-calisma-zamani.md), [ADR'ler](adr/), [Güvenlik ve KVKK](ai/security-kvkk.md)
3. [Taktik borç](03-taktiksel-tasarim/06-taktik-borc.md) ve [yol haritası](ai/roadmap.md) — evrim kararları

## Belgeleri güncel tutma

- Kod değişikliği belgede anlatılan bir kuralı, ucu, olayı veya sınırı değiştiriyorsa **aynı değişiklikte** ilgili belge güncellenir (inceleme listesinde madde).
- Yeni bounded context → [katalog](02-baglamlar/README.md)'a sayfa + [bağlam haritası](01-stratejik-tasarim/03-baglam-haritasi.md) + ADR.
- Yeni terim → [ortak dil](01-stratejik-tasarim/02-ortak-dil.md).
- Diyagramlar Mermaid ile yazılır (GitHub ve VS Code önizlemesi çizer); resim dosyası kullanılmaz.
- Bu dizin bir Obsidian kasasıdır (`docs/` klasörünü kasa olarak açın); `[[ad]]` bağlantıları ve graf görünümü çalışır.
- `docs/ai/` kısa ve kural odaklıdır (Claude Code her oturumda okur); ayrıntılı anlatım bu dizinin numaralı bölümlerindedir.
