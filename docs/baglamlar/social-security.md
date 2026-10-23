# social-security — SGK

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/social-security` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | SGK işyeri, e-Bildirge, işe giriş/çıkış, e-Rapor (sağlık verisi), iş kazası, kontrol listesi |
| Aggregate'ler (kök) | `Workplace`, `EBildirgeDocument`, `EmploymentEvent`, `SickLeaveReport`, `WorkAccident` |
| Yayınladığı olaylar | `SgkDataImported`, `SickLeavePending` |
| Özellik anahtarları | `sgk.*` |
| Veritabanı şeması | `social_security` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/social-security/`, `apps/web/src/features/social-security/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
