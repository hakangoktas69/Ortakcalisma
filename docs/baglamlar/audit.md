# audit — Denetim

> Durum: **C aşaması (2026-10-25)**: değiştirilemez denetim kaydı (`audit.entries`, ofis başına hash zinciri, yalnız `audit.record()`); kurum hesabı kaydı ve CSV dışa aktarma yazıyor. Görüntüleme ekranı yok. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/audit` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | Değiştirilemez denetim kaydı (kurum şifresi okuma, yetki değişikliği, satış işlemleri) |
| Aggregate'ler (kök) | `AuditEntry` |
| Yayınladığı olaylar | — |
| Özellik anahtarları | `yonetim.denetim_kaydi.*` |
| Veritabanı şeması | `audit` |

## Kurallar

_(Bağlamın iş kuralları geliştirildikçe buraya yazılır; her kural bir domain testine bağlanır.)_

## BFF uçları ve ekranlar

_(`apps/web/src/app/api/audit/`, `apps/web/src/features/audit/` — eklendikçe.)_

## Testler

_(Kabul testleri `@F:<anahtar>` etiketli; durum: [ozellik-durumu.md](../ozellik-durumu.md).)_

## Açık işler

_(—)_
