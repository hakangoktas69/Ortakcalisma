# organization — Ofis

> Durum: **B aşaması (2026-10-25)**: ofis ve müşavir kaydı (tablolar, RLS). Davet ve ofis ayarları yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/organization` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Ofis, müşavir, üyelik, davet |
| Aggregate'ler (kök) | `Organization`, `Advisor`, `Invitation` |
| Yayınladığı olaylar | `AdvisorAdded` |
| Özellik anahtarları | `ayarlar.*` |
| Veritabanı şeması | `organization` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/organization/`, `apps/web/src/features/organization/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
