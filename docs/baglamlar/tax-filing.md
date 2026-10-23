# tax-filing — Beyanname

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/tax-filing` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | e-Beyanname sözleşmeleri, beyannameler, tahakkuklar, son gün kuralları |
| Aggregate'ler (kök) | `FilingContract`, `Declaration` |
| Yayınladığı olaylar | `DeclarationsImported`, `DeadlineApproaching` |
| Özellik anahtarları | `beyanname.*`, `firmalar.gib_sozlesmeler.*` |
| Veritabanı şeması | `tax_filing` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/tax-filing/`, `apps/web/src/features/tax-filing/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
