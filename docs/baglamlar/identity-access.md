# identity-access — Kimlik ve yetki

> Durum: **iskelet** (kod yok, tüm özellikler kırmızı). Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/identity-access` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Kullanıcı, oturum, MFA, yetki ağacı, rol şablonları, kişiye özel izin, personel ataması |
| Aggregate'ler (kök) | `User`, `Role`, `PermissionOverride`, `StaffAssignment` |
| Yayınladığı olaylar | `PermissionsChanged` |
| Özellik anahtarları | `oturum.*`, `yonetim.kullanicilar.*`, `ayarlar.profil.*` |
| Veritabanı şeması | `identity_access` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/identity-access/`, `apps/web/src/features/identity-access/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
