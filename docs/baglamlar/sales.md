# sales — Satış portalı

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/sales` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Satış kullanıcıları, ofis/müşavir/mükellef hesabı açma, sözleşme ve mükellef onayı kaydı, dondurma, shard ataması (D27). **Mükellef iş verisini görmez** |
| Aggregate'ler (kök) | `SalesUser`, `SalesAccount`, `SalesContract` |
| Yayınladığı olaylar | `OrganizationProvisioned`, `TaxpayerProvisioned` |
| Özellik anahtarları | `satis.*` |
| Veritabanı şeması | `sales` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/sales/`, `apps/web/src/features/sales/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
