# invoicing

> Alt alan: Destekleyici · Kod: `apps/api/src/modules/invoicing/` · Şema: `prisma/schema/invoicing.prisma` · Kalıp: **ACL** (UBL-TR)

## Sorumluluk

Entegratörlerden indirilen UBL-TR e-Fatura/e-Arşiv XML (veya ZIP) dosyalarını içe alır, satış/alış olarak mükelleflere eşler, dönem bazında **KDV ön kontrol** üretir.
**Yapmaz:** beyanname yerine geçmez (devreden KDV, ithalat, serbest meslek makbuzu, ÖKC dahil değil); satır detayı saklamaz (veri minimizasyonu).

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `Invoice` | (`companyId`, `direction`, `uuid`=ETTN) | Satıcı VKN'si büroda bir mükellefse onun **satışı**, alıcı VKN'si ise **alışı**; iki mükellef arasındaki fatura iki tarafa da yazılır · aynı ETTN ikinci kez atlanır · `period` düzenleme tarihinden |

## İş kuralları

- `application/invoices.service.ts` `kdvBuckets()` — hesaplanan KDV, satış tevkifatı, indirilecek KDV, KDV2 (alıcı sıfatıyla tevkifat), oran kırılımı, iadeler, döviz kuru. *(Saf fonksiyon; `domain/`'e taşınmalı — [taktik borç](../03-taktiksel-tasarim/06-taktik-borc.md).)*
- `infrastructure/ubl-parser.ts` — ETTN, numara, senaryo, tip, taraflar, matrah, KDV (vergi kodu 0015), diğer vergiler, tevkifat; **XXE kapalı**.
- `infrastructure/invoice-files.ts` — ZIP'ler akış olarak, gerçek açılan bayt sayılarak (dosya başı 5 MB, toplam 300 MB); istek başı 20 dosya / 25 MB / 3000 fatura.

## Kullanım senaryoları

`InvoicesService`: `importFiles` (önizleme → onay), `list` (100'erli sayfa), `overview(period)`, `kdv(companyId, period)`, `remove`.

## HTTP uçları

| Metot | Yol | Not |
|---|---|---|
| POST | `/api/invoices/import?dryRun=` (`files`) | hız sınırı |
| GET | `/api/invoices?companyId=&period=&direction=&q=&skip=` | |
| GET | `/api/invoices/overview?period=`, `/kdv?companyId=&period=` | başka büronun firması → 404 |
| DELETE | `/api/invoices/:id` | entegratördeki fatura etkilenmez |

## Olaylar

Yok.

## Testler

`application/invoices.spec.ts` (ayrıştırma, KDV kovaları, tevkifat, döviz) · e2e `test/invoicing-payroll.e2e-spec.ts` (XML/ZIP aktarım, tekilleştirme, XXE, filtreler, KDV, silme, izolasyon). Test verisi `infrastructure/ubl-sample.ts` ile üretilir (gerçek fatura değil).

## Bilinen sınırlar ve genişletme

Entegratör API'si (otomatik çekme) seçilince aynı `Invoice` modeline ikinci kaynak olarak eklenecek (`InvoiceSource`).
