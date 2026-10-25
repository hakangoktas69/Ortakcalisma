# tebligat

> Alt alan: Destekleyici · Kod: `apps/api/src/modules/tebligat/` · Şema: `prisma/schema/tebligat.prisma`

## Sorumluluk

GİB e-Tebligatlarını mükellef bazında tutar, **tebliğ sayılma tarihini** hesaplar ve büro içi "incelendi" takibini sağlar.
**Yapmaz:** GİB'deki okunma durumunu değiştirmez; GİB'e bağlanmaz (veri eklentiden).

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `ETebligat` | (`companyId`, `documentNo`) benzersiz | `deemedServedAt` = ulaşma tarihini izleyen **5. günün sonu** (VUK 107/A) · belge no yoksa içerikten kararlı anahtar türetilir (tekrar aktarım kopya üretmez) · tekrar aktarımda yalnız `readAtGib` güncellenir |

## İş kuralları

`infrastructure/tebligat-parser.ts`: `deemedServedDate` (VUK 107/A), başlık tanıma `mapTebligatHeaders`, `parseTebligatTables` (beyanname tablolarını `mapDeclarationHeaders` ile ayırt edip atlar). Not: `deemedServedDate` bir domain kuralıdır, `domain/`'e taşınmalı ([taktik borç](../03-taktiksel-tasarim/06-taktik-borc.md)).

## Kullanım senaryoları

`TebligatService`: `importTables(tenantId, tables, dryRun, fallbackTaxNumber)` (data-intake için) · `list` · `summary` · `setReviewed`. Yeni tebligatlar için firma başına **`tebligat.imported`** olayı yayınlar.

## HTTP uçları

| Metot | Yol | Not |
|---|---|---|
| GET | `/api/tebligat?status=open\|all&days=&q=` | |
| GET | `/api/tebligat/summary` | özet sayıları |
| PUT | `/api/tebligat/:id/review` `{ reviewed }` | başka büronunki → 404 |

## Olaylar

Yayınlar: `tebligat.imported` `{ companyId, companyTitle, count, first: { subject, sender, deemedServedAt } }` → notifications. Dışa açtığı: `TebligatModule`, `TebligatService`, olay tipi.

## Testler

`infrastructure/tebligat-parser.spec.ts` · e2e `test/sgk-tebligat-intake.e2e-spec.ts` (önizleme/onay, VUK 107/A tarihi, olay yazımı, tekrar aktarım, liste/özet/inceleme, başka büronun mükellefine yazılamaz), `test/worker.e2e-spec.ts` (olay → bildirim, dış kanalda unvan yok).

## Bilinen sınırlar

Gerçek GİB e-Tebligat sayfa başlıkları henüz canlı doğrulanmadı (yol haritası). Resmi tatil etkisi yok (tebliğ sayılma takvim günüyle).
