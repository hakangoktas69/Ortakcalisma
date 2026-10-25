# tax-filing — Beyanname

> Durum: **D aşaması (2026-10-25)**: e-Beyanname sözleşme listesinin ofise uygulanması (doğrulama, mükellef eşleme/açma, sözleşme kaydı) ve sözleşmeler ekranı. Beyannameler ve kurum incelemesi E aşamasında. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/tax-filing` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | e-Beyanname sözleşmeleri, beyannameler, tahakkuklar, son gün kuralları |
| Aggregate'ler (kök) | `FilingContract` (tablo `tax_filing.filing_contracts`); `Declaration` henüz yok |
| Yayınladığı olaylar | `DeclarationsImported`, `DeadlineApproaching` (henüz yok) |
| Özellik anahtarları | `beyanname.*`, `firmalar.gib_sozlesmeler.*` |
| Veritabanı şeması | `tax_filing` (shard) |

## Kurallar

- Liste girdisi Python ACL'in yayımlanmış dilidir ([eworks.gib.contracts.v1](../../contracts/integration/eworks.gib.contracts.v1.schema.json)); işçi şemayla doğrulamadan uygulamaz.
- **Fail-closed** (`domain/contract-list.ts`, eski robotun `validate_contracts`'ı): GİB toplamı okunan satırla tutmazsa, VKN/TCKN biçimi bozuksa, zorunlu alan eksikse ya da aynı mükellef + sözleşme iki kez geldiyse liste hiç uygulanmaz.
- Mükellef kimliği VKN, yoksa TCKN'dir. Ofiste aynı kimlikli firma varsa eşleşir (vergi dairesi ve — kaynağı GİB olan firmada — unvan güncellenir); yoksa müşavirin portföyüne yeni firma kartı açılır (grup "GİB Aktarımı", tür unvandan çıkarılır).
- Kimlik başka ofiste kayıtlıysa (tek müşavir, D16) ya da kontrol hanesi tutmuyorsa mükellef alınmaz, özet içinde sayılır.
- Kaynaktan kalkan firma ya da sözleşme silinmez. Her sözleşme kaynağını (`gib_live` / `sahte_gib`) ve son görüldüğü işi taşır; demo verisi ekranda açıkça belirtilir.
- Beyanname erişim kanıtı yalnız "Aracılık ve Sorumluluk" sözleşmesidir (`isIntermediaryContract`; E aşamasında kurum incelemesinde kullanılır).

## BFF uçları ve ekranlar

- `/firmalar/gib_sozlesmeler`: müşavir GİB hesabı durumu, "GİB'den güncelle", son iş durumu, sayaçlar, sözleşme tablosu.
- Senkron ucu sync bağlamındadır ([sync.md](sync.md)).

## Testler

- Birim: `test/domain/contract-list.test.ts`, `test/application/contracts.test.ts`.
- Kabul: `apps/web/e2e/gib-sozlesmeler.e2e.ts` — `firmalar.gib_sozlesmeler.view` yeşil; `.sync` canlı doğrulama bekliyor (D33).

## Açık işler

- Beyanname senkronu, PDF'ler, beyanname listesi/kontrol ekranları, kurum incelemesi (`firmalar.gib_sozlesmeler.review`) — E aşaması.
