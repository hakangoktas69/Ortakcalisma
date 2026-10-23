# sync — Senkron işleri

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/sync` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Entegrasyon kaydı, taşıma yolu (servis/robot, D19), iş planlama, istek bütçesi, iş/adım durumu, sonuç dağıtımı |
| Aggregate'ler (kök) | `Integration`, `SyncJob`, `RatePolicy`, `NightPlan` |
| Yayınladığı olaylar | `SyncJobCompleted`, `SyncJobFailed` |
| Özellik anahtarları | `beyanname.senkron.*`, `yonetim.zamanlama.*`, `yonetim.hiz_politikasi.*` |
| Veritabanı şeması | `sync` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/sync/`, `apps/web/src/features/sync/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
