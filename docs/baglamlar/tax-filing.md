<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **tax-filing**
<!-- /gezinti -->

# tax-filing — Beyanname

> Durum: **E aşaması (2026-10-25)**: e-Beyanname sözleşme listesi (D), beyanname listesi + PDF'ler, kurum incelemesi kuralı, görüntüleme / CSV / kontrol / belge ekranları. Son gün kuralları ve pilot bölge ayarları yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/tax-filing` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | e-Beyanname sözleşmeleri, beyannameler, tahakkuklar, son gün kuralları |
| Aggregate'ler (kök) | `FilingContract` (`tax_filing.filing_contracts`), `Declaration` (`tax_filing.declarations`) |
| Yayınladığı olaylar | `DeclarationsImported`, `DeadlineApproaching` (henüz yok) |
| Özellik anahtarları | `beyanname.*`, `firmalar.gib_sozlesmeler.*` |
| Veritabanı şeması | `tax_filing` (shard) |

## Kurallar

### Sözleşme listesi

- Girdi Python ACL'in yayımlanmış dilidir ([eworks.gib.contracts.v1](../../contracts/integration/eworks.gib.contracts.v1.schema.json)); işçi şemayla doğrulamadan uygulamaz.
- **Fail-closed** (`domain/contract-list.ts`, eski robotun `validate_contracts`'ı): GİB toplamı okunan satırla tutmazsa, VKN/TCKN biçimi bozuksa, zorunlu alan eksikse ya da aynı mükellef + sözleşme iki kez geldiyse liste hiç uygulanmaz.
- Mükellef kimliği VKN, yoksa TCKN'dir. Ofiste aynı kimlikli firma varsa eşleşir (vergi dairesi ve — kaynağı GİB olan firmada — unvan güncellenir); yoksa müşavirin portföyüne yeni firma kartı açılır (grup "GİB Aktarımı", tür unvandan çıkarılır).
- Kimlik başka ofiste kayıtlıysa (tek müşavir, D16) ya da kontrol hanesi tutmuyorsa mükellef alınmaz, özet içinde sayılır.
- Kaynaktan kalkan firma ya da sözleşme silinmez. Her kayıt kaynağını (`gib_live` / `sahte_gib`) ve son görüldüğü işi taşır; demo verisi ekranda açıkça belirtilir.

### Beyannameler ve kurum incelemesi

- Girdi: [eworks.gib.declarations.v1](../../contracts/integration/eworks.gib.declarations.v1.schema.json). Robot **aynı GİB oturumunda** önce sözleşme listesini okur (sonuçla birlikte gelir ve önce uygulanır), sonra yalnız geçerli **"Aracılık ve Sorumluluk"** sözleşmesi olan mükellefler için e-Beyanname'yi, gönderim ayı başına bir sorguyla tarar (eski portalın kurum incelemesi kuralı, `institution-review.js`).
- İşçi her sorguyu yeniden denetler (`domain/declaration.ts`): kanıttaki sözleşme numarası aynı oturumun listesinde bu mükellefin Aracılık ve Sorumluluk sözleşmesi olmalı; dönem `YYYY-MM` ve sıralı, yükleme günü (İstanbul) sorgu aralığında, satır kimliği tekil. Doğrulanmayan sorgunun hiçbir kaydı yazılmaz; diğer sorgular uygulanır, özet sayar.
- Boş sonuç yalnız GİB'in açık "kriterlere uyan beyanname bulunamamıştır" yanıtıdır; diğer uyarılar başarısız sorgudur (eski robot davranışı).
- Kaynak satır kimliği firmada tekildir; yeniden görülen kayıt güncellenir, kaynaktan kalkan kayıt silinmez.
- Senkron kapsamı: gönderim ay aralığı, en çok 12 ay, gelecek kısmı bugüne kırpılır; tek mükellef seçilirse onun Aracılık ve Sorumluluk sözleşmesi olmalıdır.
- Kontrol ekranı: sözleşmeli mükellef × son 6 vergilendirme dönemi; boş hücre "kayıt yok ya da o ay senkronlanmadı".

## BFF uçları ve ekranlar

- `/firmalar/gib_sozlesmeler`: müşavir GİB hesabı, "GİB'den güncelle", son iş, sayaçlar, **kurum incelemesi** (mükellef başına beyanname erişimi), sözleşme tablosu.
- `/beyanname/senkron` + `POST /api/sync/beyannameler`, `/beyanname/liste` + `GET /api/beyanname/csv`, `/beyanname/kontrol`, `/beyanname/belge` (belgeler: [documents.md](documents.md)).

## Testler

- Birim: `test/domain/contract-list.test.ts`, `test/domain/declaration.test.ts`, `test/application/contracts.test.ts`, `test/application/declarations.test.ts`; işçi: `apps/worker/test/uygulayici.test.ts`.
- Python ACL: `services/integration/tests/test_beyanname.py` (satır kuralları; gerçek tarayıcıyla sahte GİB'e karşı sözleşme → e-Beyanname → sayfalama → PDF'ler; boş sonuç).
- Kabul: `apps/web/e2e/gib-sozlesmeler.e2e.ts`, `apps/web/e2e/beyanname.e2e.ts`. Yeşil: `firmalar.gib_sozlesmeler.view/review`, `beyanname.liste.*`, `beyanname.kontrol.view`. `firmalar.gib_sozlesmeler.sync` ve `beyanname.senkron.start` canlı GİB kaydı bekliyor (D33).

## Açık işler

- Canlı e-Beyanname ekranının yeniden doğrulanması (eski robot canlıda doğrulanmıştı; bu taşımada sahte sunucuya karşı sınandı).
- Son gün kuralları, pilot bölge ayarları, senkron iptali (`beyanname.senkron.cancel`), tahakkuk tutarlarının ayrıştırılması.

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **tax-filing**
<!-- /gezinti -->
