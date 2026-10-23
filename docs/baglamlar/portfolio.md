# portfolio — Mükellef portföyü

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/portfolio` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Mükellef kartı, müşavir bağı (tek müşavir, D16), mükellef kullanıcıları, devir |
| Aggregate'ler (kök) | `Taxpayer`, `AdvisorTransfer` |
| Yayınladığı olaylar | `TaxpayerRegistered`, `TaxpayerTransferred` |
| Özellik anahtarları | `firmalar.*`, `yonetim.mukellef_kullanicilari.*` |
| Veritabanı şeması | `portfolio` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/portfolio/`, `apps/web/src/features/portfolio/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
