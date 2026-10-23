# workspace — Çalışma alanı

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/workspace` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Görev, not, uyarı/okundu, kontrol listeleri (okuma modeli) |
| Aggregate'ler (kök) | `Task`, `Note` |
| Yayınladığı olaylar | — |
| Özellik anahtarları | `genel_bakis.*`, `gorevler.*`, `notlar.*`, `raporlar` (sayfaları henüz atanmadı) |
| Veritabanı şeması | `workspace` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/workspace/`, `apps/web/src/features/workspace/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
