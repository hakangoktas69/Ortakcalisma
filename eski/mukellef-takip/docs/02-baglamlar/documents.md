# documents

> Alt alan: Destekleyici · Kod: `apps/api/src/modules/documents/` · Şema: `prisma/schema/documents.prisma`

## Sorumluluk

Dilekçe şablonları (6 hazır + büronun kendi şablonları) ve üretilmiş dilekçe arşivi.
**Yapmaz:** dilekçeyi kuruma göndermez; hukuki doğruluk garantisi vermez (şablonlar örnektir).

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `PetitionTemplate` | `id`; `tenantId = null` → sistem şablonu | Sistem şablonları **değiştirilemez/silinemez** (RLS yazma politikası + servis koşulu); herkes okuyabilir |
| `Petition` | `id` | Kullanıcının son düzenlediği tam metin saklanır; mükellef büroya ait olmalı |

## İş kuralları (domain)

`domain/petition-templates.ts`: `BUILTIN_TEMPLATES` (genel, pişmanlık VUK 371, izaha davet VUK 370, uzlaşma, borcu yoktur, SGK idari para cezası itirazı), `placeholders(body)` (`{{alan}}`), `fill`, `FIELD_LABELS` / `fieldLabel`. Otomatik dolan alanlar: `firma_unvani`, `vkn`, `vergi_dairesi`, `tarih`, `buro_adi`, `kullanici_adi`.

## Kullanım senaryoları

`PetitionsService`: şablon listele/ekle/güncelle/sil, `prepare(templateId, companyId)` → metin + alan listesi (otomatik alanlar dolu değerle, diğerleri boş; **doldurma istemcide**), arşive kaydet/listele/getir/sil.

## HTTP uçları

`GET/POST/PUT/DELETE /api/petitions/templates[/:id]` · `POST /api/petitions/prepare` · `GET/POST /api/petitions` · `GET/DELETE /api/petitions/:id`

## Testler

`domain/petition-templates.spec.ts` · e2e `test/billing-documents-assistant.e2e-spec.ts` (şablon yaşam döngüsü, sistem şablonu korunur, hazırlama alanları, arşiv, başka büronun firması 404).
