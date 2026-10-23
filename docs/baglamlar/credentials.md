# credentials — Kurum hesapları

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/credentials` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Kurum hesabı, Vault, kullanım izni, mükellef onayı (D18), kilitlenme koruması |
| Aggregate'ler (kök) | `InstitutionAccount`, `CredentialGrant`, `CredentialConsent` |
| Yayınladığı olaylar | `AccountLockedOut`, `ConsentRevoked` |
| Özellik anahtarları | `firmalar.kurum_hesaplari.*` |
| Veritabanı şeması | `credentials` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/credentials/`, `apps/web/src/features/credentials/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
