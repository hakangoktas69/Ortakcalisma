# taxpayers

> Alt alan: Destekleyici — **paylaşılan çekirdek varlık** · Kod: `apps/api/src/modules/taxpayers/` · Şema: `prisma/schema/taxpayers.prisma`

## Sorumluluk

Mükellef (firma) kartının sahibi: oluşturma, güncelleme, aktif/pasif, arama, Excel/CSV toplu aktarım.
**Yapmaz:** hangi beyannameleri vereceğine karar vermez (tax-filing `CompanyObligation`); lisans kotasını yönetmez (billing — okur).

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `Company` | `id`; büro içinde benzersiz `taxNumber` (`@@unique([tenantId, taxNumber])`) | VKN 10 / TCKN 11 hane · ekleme lisans geçerli ve kota dolmamışken · aynı VKN ikinci kez → **409** |

`Company`, bütün bağlamların büro kapsamı için kullandığı **paylaşılan kimliktir**: diğer bağlamlar `company.tenantId` üzerinden salt okuma JOIN'i yapabilir (bilinçli istisna, [bağlam haritası](../01-stratejik-tasarim/03-baglam-haritasi.md)).

## İş kuralları

`infrastructure/company-import.ts`: başlık eşleme (`mapHeaders` — "VKN", "Vergi kimlik no", "T.C." …), tür tanıma (`parseCompanyType`), satır doğrulama (`validateRow`: boş unvan, hatalı numara, geçersiz e-posta, TCKN kontrol hanesi uyarısı, tür boşsa numara uzunluğundan tahmin), dosya içi tekrar. Ortak okuma `platform/files/spreadsheet.ts` (`readSheet`, zip bombası kontrolü).

## Kullanım senaryoları

Şu an ince controller (`interface/http/companies.controller.ts`) doğrudan Prisma kullanır — basit CRUD için bilinçli pragmatizm ([ADR 0002](../adr/0002-ddd-katmanlari.md)). Aktarım: önizleme (`dryRun`, varsayılan) → onay; kota aşan satırlar hata olur; mevcut VKN güncellenir, boş hücre mevcut bilgiyi silmez.

## HTTP uçları

| Metot | Yol | Yetki | Not |
|---|---|---|---|
| GET | `/api/companies?q=&type=` | oturum | unvana göre sıralı |
| POST | `/api/companies` | oturum | lisans + kota |
| PATCH | `/api/companies/:id` | oturum | başka büronunki → 404 |
| GET | `/api/companies/import/template` | oturum | .xlsx şablon |
| POST | `/api/companies/import?dryRun=` | ADMIN, hız sınırı | .xlsx/.csv, ≤ 2 MB |

## Olaylar

Yok (aday: `taxpayers.company.created` → tax-filing varsayılan yükümlülükleri).

## Testler

`infrastructure/company-import.spec.ts` · e2e `test/taxpayers-tax-filing.e2e-spec.ts` (liste/arama/filtre, VKN çakışması 409, kota ve süresi dolmuş lisans, şablon, CSV önizleme/yazma/güncelleme, yetki, dosya türü).

## Bilinen sınırlar

Kota/lisans kontrolü `subscription` tablosunu doğrudan okuyor (billing facade'ı adayı). Silme yok (pasifleştirme var).
