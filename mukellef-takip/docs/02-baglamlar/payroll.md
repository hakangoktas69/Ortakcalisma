# payroll

> Alt alan: Destekleyici · Kod: `apps/api/src/modules/payroll/` · Şema: `prisma/schema/payroll.prisma`

## Sorumluluk

Bordro programının personel bazlı Excel/CSV çıktısını içe alır, satır kontrolleri yapar ve aynı dönemin **e-Bildirge** belgeleriyle mutabakat kurar.
**Yapmaz:** bordro hesaplamaz (gelir/damga vergisi istisnalar nedeniyle programın sonucu olduğu gibi saklanır).

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `PayrollRun` (+ `PayrollLine`) | (`companyId`, `workplaceKey`, `period`) | Firma + işyeri + dönem başına **tek bordro**; yeniden yükleme öncekinin yerine geçer (önizlemede uyarılır) · satır kimlik alanları **şifreli** · firmanın tek işyeri varsa otomatik seçilir |

`workplaceKey` = `workplaceId ?? ""` (PostgreSQL `NULL`'ları eşit saymadığı için tekillik anahtarı).

## İş kuralları

- `infrastructure/payroll-parser.ts`: başlık ilk 15 satırda aranır (üst başlıklar ve TOPLAM atlanır); zorunlu sütunlar T.C. Kimlik No, Gün, SGK Matrahı; `lineWarnings`: SGK işçi payı %14 (5510 md. 81), işsizlik %1 (4447 md. 49), ≤ 30 gün, net ≤ brüt (1 TL tolerans); geçersiz T.C. ve tekrar eden kişi **hata**.
- `application/payroll.service.ts` `payrollTotals()`, `reconcile()` — e-Bildirge'de asıl + ek − iptal; kişi sayısı yalnız asıl belgeden; PEK'te 1 TL tolerans → `OK | MISMATCH | NO_EBILDIRGE`. *(Saf; `domain/`'e taşınmalı.)*

## Kullanım senaryoları

`PayrollService`: `importFile` (önizleme → transaction içinde eski koşuyu silip yenisini yazma), `overview(period)` (bordrosu eksik işyerleri dahil), `run(id)` (kişi alanları çözülür, T.C. maskeli, `pii.read` denetim kaydı, ad sıralaması çözümden sonra), `remove`, `template`.

## HTTP uçları

| Metot | Yol | Not |
|---|---|---|
| GET | `/api/payroll/template` | .xlsx |
| POST | `/api/payroll/import?dryRun=` (`file`, `companyId`, `period`, `workplaceId?`) | hız sınırı |
| GET | `/api/payroll/overview?period=` | |
| GET / DELETE | `/api/payroll/runs/:id` | |

## Bağımlılıklar

e-Bildirge belgelerini ve işyerlerini **doğrudan okuyor** (geçiş istisnası; social-security facade'ı adayı).

## Testler

`application/payroll.spec.ts` (ayrıştırma, satır kuralları, mutabakat) · e2e `test/invoicing-payroll.e2e-spec.ts` (şablon, önizleme hataları, şifreli yazım, maskeli detay, genel bakış, silme, geçersiz dönem, izolasyon).

## Bilinen sınırlar

Gerçek bordro programı çıktılarıyla sütun kalıpları doğrulanmadı.
