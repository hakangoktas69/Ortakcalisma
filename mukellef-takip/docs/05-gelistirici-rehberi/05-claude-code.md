# 5.5 Claude Code ve ekip hafızası

> Önce: [İlk gün](01-ilk-gun.md) · İlgili: [Claude bağlamı](../ai/), [Ekip hafızası](../ai/memory/MEMORY.md)

Claude Code bu projede **sıfırdan başlamaz**. Bildiği her şey depodadır ve git ile sürümlenir:

- kurallar
- mimari
- güncel durum
- ekibin zamanla öğrendikleri

Repoyu çeken ve Claude Code'u açan geliştirici aynı bağlamla çalışır. Kendi makinesinde ek bir kurulum yapması gerekmez.

## Hafıza katmanları

Claude Code oturum başında yukarıdan aşağı yükler. Alttaki daha özeldir ve öncelik kazanır.

| Katman | Dosya | Git'te | Ne yazılır |
|---|---|---|---|
| Kişisel, tüm projeler | `~/.claude/CLAUDE.md` | hayır | Kişinin genel çalışma tercihleri |
| Depo kökü | `Ortakcalisma/CLAUDE.md` | evet | Klasör sahipliği, ortak kurallar |
| Proje | `mukellef-takip/CLAUDE.md` | evet | Pazarlıksız kurallar, yapı, komutlar; `@docs/ai/*.md` ile içe aktarım |
| Proje bağlamı | `docs/ai/*.md` | evet | Vizyon, mimari, bağlamlar, güvenlik, kurallar, test, **yol haritası** |
| Uygulama | `apps/{api,web,mobile}/CLAUDE.md` | evet | O uygulamaya özel kurallar (o dizinde çalışınca yüklenir) |
| **Ekip hafızası** | `docs/ai/memory/` | evet | Öğrenilmiş, kodda görünmeyen bilgi: düzeltmeler, kısıtlar, dış kaynaklar |
| Kişisel, bu proje | `CLAUDE.local.md` | hayır (gitignore) | Kişinin bu projedeki özel notları |
| Paylaşılan ayar | `.claude/settings.json` | evet | İzinler, kancalar |
| Kişisel ayar | `.claude/settings.local.json` | hayır | Makineye özel ayar; kanca `autoMemoryDirectory`'yi buraya yazar |
| Beceriler | `.claude/skills/*/SKILL.md` | evet | `/hafiza`, `/oryantasyon` |

## Ekip hafızası nasıl çalışır

Claude Code'un *otomatik hafızası*, öğrendiklerini varsayılan olarak her geliştiricinin kendi diskinde tutar: `~/.claude/projects/<yol>/memory/`. Bu bilgi başkasına geçmez. Bu projede hafıza dizini depodaki `docs/ai/memory/` dizinine yönlendirilir:

1. `.claude/settings.json` bir **SessionStart kancası** kaydeder. Kanca hem depo kökünde hem `mukellef-takip/` altında kayıtlıdır, yani iki dizinden biri açılınca çalışır. Kanca `node tools/claude/session-start.mjs` komutunu çalıştırır.
2. Betik `.claude/settings.local.json` dosyasına `autoMemoryDirectory: <depo>/mukellef-takip/docs/ai/memory` yazar. Yol mutlaktır. Claude Code bu ayarı güvenlik gereği paylaşılan `settings.json`'dan kabul etmez; yalnız yerel ayardan okur. Bu yüzden bir kanca gerekiyor.
3. İlk oturumda betik `MEMORY.md`'yi bağlama da ekler. Sonraki oturumlarda Claude Code dizini kendisi yükler.
4. Betik iki durumda Claude'a not düşer:
   - kişisel hafızada eski kayıt varsa
   - son 14 günde ekip hafızası değiştiyse; kim, ne zaman, ne öğrendi
5. Claude yeni bir şey öğrendiğinde dosyayı doğrudan `docs/ai/memory/` altına yazar. Değişiklik `git status`'ta görünür ve PR ile ekibe gider.

`node` PATH'te olmalıdır. Yerel Node sürümü önemli değil; betik yalnız yerleşik modülleri kullanır.

### Hafızaya ne yazılır, ne yazılmaz

| Bilgi | Yeri |
|---|---|
| Kodda veya git geçmişinde zaten olan | hiçbir yer |
| Her oturumda uyulacak kural | `docs/ai/*.md` / `CLAUDE.md` |
| Gerekçeli mimari karar | `docs/adr/` |
| Bağlamın kuralı, ucu veya olayı | `docs/02-baglamlar/<context>.md` |
| Tuzak, sık soru | [Tuzaklar](04-tuzaklar.md) |
| Kullanıcının düzeltmesi ve gerekçesi (*feedback*); kodda görünmeyen proje kısıtı veya durum (*project*); dış kaynak (*reference*) | **ekip hafızası** |
| Kişiye özel tercih (*user*) | `CLAUDE.local.md` veya `~/.claude/CLAUDE.md` |
| Kişisel veri, sır, gerçek mükellef bilgisi | **hiçbir yer** |

`node tools/claude/check-memory.mjs` (`npm run memory:check`) şunları denetler:

- her kaydın ön bilgisi (`name` = dosya adı, `description`, `metadata.type`)
- `MEMORY.md` indeksinin tutarlılığı ve 200 satır sınırı (fazlası yüklenmez)
- geçerli TCKN, IBAN, e-posta, telefon, anahtar ve parola kalıpları

Denetim `npm run verify` başında ve CI'da çalışır. Ayrıca gitleaks bütün depoyu tarar.

### Ekip akışı

- Hafıza değişikliği koddur: PR'da gözden geçirilir. İncelemede bakılacaklar:
  - doğru katmanda mı (tablo yukarıda)
  - kalıcı bir kural mı; öyleyse `docs/ai`'ye taşınmalı
  - kişisel veri var mı
- `MEMORY.md` git'te `merge=union` ile birleşir; aynı anda eklenen satırlar çakışmaz. Birleştirmeden sonra mükerrer satır kalırsa `memory:check` yakalar.
- Kayıt eskidiyse güncellenir ya da silinir. Hafıza tarihçe değildir; tarihçe git'tedir.
- `/hafiza denetle` kayıtları kodla karşılaştırır ve eskimiş olanları bulur. Birkaç haftada bir çalıştırın.

## Beceriler

| Komut | Ne yapar |
|---|---|
| `/oryantasyon` | Yeni geliştirici için güncel durum özeti, ortam kontrolü, role göre okuma yolu ve ilk iş önerisi |
| `/hafiza <bilgi>` | Bilgiyi doğru katmana yazar; ekip hafızasıysa biçim ve denetimle |
| `/hafiza aktar` | Kişisel hafızadaki proje kayıtlarını sınıflandırır, onayla ekip hafızasına taşır |
| `/hafiza denetle` | Eskimiş, mükerrer veya yanlış katmandaki kayıtları bulur |

## Codex ve diğer ajanlar

Codex, `CLAUDE.md` yerine yoldaki `AGENTS.md` dosyalarını okur (depo kökünden çalışılan dizine kadar). Depoda iki tane var:

- `Ortakcalisma/AGENTS.md`: klasör sahipliği ve ortak kurallar
- `mukellef-takip/AGENTS.md`: oturum başında okunacak dosyalar, hafıza biçimi, iş bitirme adımları

`AGENTS.md` kuralları kopyalamaz; ajanı `CLAUDE.md`, `docs/ai/` ve ekip hafızasına yönlendirir. Kural değişince yalnız kaynak dosya güncellenir, iki araç da aynısını okur.

Codex'te Claude'un şu özellikleri yoktur; `AGENTS.md` bunları talimatla karşılar:

| Claude Code | Codex karşılığı |
|---|---|
| `@docs/ai/*.md` içe aktarımı | ajan dosyaları kendisi açıp okur |
| SessionStart kancası, son 14 günün hafıza değişiklikleri | `MEMORY.md` okunur, `git log` ile değişikliklere bakılır |
| Otomatik hafıza | kayıt aynı biçimle elle yazılır, `npm run memory:check` çalıştırılır |
| `/hafiza`, `/oryantasyon` | ilgili `.claude/skills/*/SKILL.md` okunup uygulanır |

Codex'in bağlamı okuyup okumadığını sınamak için oturum başında şunu sorun: "Okuduğun proje kurallarını 5 maddede özetle." Codex'in yazdığı hafıza kayıtları da PR'da ve CI'daki `memory:check` ile denetlenir.

## Obsidian ile okuma

`docs/` bir Obsidian kasasıdır. Obsidian'da **Open folder as vault → `mukellef-takip/docs`** seçin.

- Hafıza kayıtları birbirine ve belgelere `[[dosya-adı]]` ile bağlanır. Graf görünümünde hafıza, `ai`, ADR, bağlamlar ve rehber ayrı renklerdedir.
- Paylaşılan ayarlar `.obsidian/app.json`, `core-plugins.json` ve `graph.json`'dır. Çalışma alanı ve eklenti durumu kişiseldir, gitignore'dadır.
- Yeni not varsayılan olarak `ai/memory/`'ye açılır. Elle yazılan kayıt da yukarıdaki biçime uymalıdır, yoksa `memory:check` düşer.
- Obsidian zorunlu değildir. Aynı dosyalar VS Code'da ve GitHub'da okunur.

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Claude ekip hafızasını bilmiyor | Kancalar kapalı ya da `node` PATH'te yok. `/hooks` ile kancayı görün. Elle çalıştırmak için: `node tools/claude/session-start.mjs`. |
| Kanca "başka dizini gösteriyor" uyarısı veriyor | `settings.local.json` dosyanızda farklı bir `autoMemoryDirectory` var. Bilinçli değilse satırı silin; kanca bir sonraki oturumda doğrusunu yazar. |
| `apps/api` gibi alt dizinde açınca hafıza yok | Proje ayarları açılan dizinden okunur. Claude Code'u `mukellef-takip/` ya da depo kökünde açın. |
| Depoyu taşıdım, yol değişti | `settings.local.json`'dan `autoMemoryDirectory` satırını silin; kanca yeni yolu yazar. |
| Eski kişisel kayıtlarım var | `/hafiza aktar` |
