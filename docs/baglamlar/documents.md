# documents — Belgeler

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/documents` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | PDF metaverisi, saklama (vars. 7 gün, D15), toplu temizlik, yeniden indirme |
| Aggregate'ler (kök) | `Document`, `RetentionPolicy`, `PurgeRun` |
| Yayınladığı olaylar | `DocumentsPurged` |
| Özellik anahtarları | `beyanname.belge.*`, `yonetim.belge_temizligi.*` |
| Veritabanı şeması | `documents` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/documents/`, `apps/web/src/features/documents/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
