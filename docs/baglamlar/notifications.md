# notifications — Bildirimler

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/notifications` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Portal ve e-posta bildirimleri |
| Aggregate'ler (kök) | `Notification` |
| Yayınladığı olaylar | — |
| Özellik anahtarları | `bildirimler.*`, `ayarlar.iletisim.*` |
| Veritabanı şeması | `notifications` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/notifications/`, `apps/web/src/features/notifications/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
