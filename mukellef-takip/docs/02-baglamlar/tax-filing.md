# tax-filing ★

> Alt alan: **Çekirdek** · Kod: `apps/api/src/modules/tax-filing/` · Şema: `prisma/schema/tax-filing.prisma`

## Sorumluluk

"Bu ay hangi mükellef hangi beyannameyi vermeli, verdi mi, son gün ne zaman?" sorusunun cevabı. Yükümlülükler, beyanname kayıtları (elle / eklenti / demo GİB), kontrol matrisi, e-Defter berat takibi, vergi takvimi.
**Yapmaz:** beyanname hazırlamaz/göndermez; GİB'e bağlanmaz (canlı kaynak bilinçli olarak kapalı).

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `CompanyObligation` | (`companyId`, `type`) | Firma türüne göre varsayılanla başlar (`DEFAULT_OBLIGATIONS`), elle düzenlenir |
| `Declaration` | (`companyId`, `type`, `period`) benzersiz | Elle girilen kaydın yerini GİB/eklenti kaydı alır; **GİB kaynaklı kayıt silinemez** (yalnız `MANUAL` geri alınır) |
| `EDefterBerat` | (`companyId`, `period`) | `dueDateOverride` kural tarihinin önüne geçer (süre uzatımı, Ekim–Aralık) |
| `TaxCalendarEvent` | `id` | Bürolar arası ortak (RLS yok) |

## İş kuralları (domain — saf, testli)

`domain/declaration-rules.ts`
- `expectedForMonth(year, month)` — o ay son günü gelen beyannameler: KDV ayın 28'i, MUHSGK/Damga 26'sı (izleyen ay), geçici vergi 1.–3. dönem (çeyreği izleyen 2. ayın 17'si), yıllık gelir Mart sonu, kurumlar Nisan sonu; hafta sonu → ilk iş günü.
- `statusOf(dueDate, filedAt, now)` → `FILED | FILED_LATE | PENDING | LATE`.
- `parseControlMonth`, `periodLabel`, `DECLARATION_INFO`, `DECLARATION_ORDER`, `DEFAULT_OBLIGATIONS`.

`domain/edefter-rules.ts`
- `ruleDueDate(period, companyType)` — aylık: ilgili ayı izleyen 4. ayın 10'u (gelir) / 14'ü (kurumlar); dönemsel: dönem sonunu izleyen 2. ayın 10'u / 14'ü. **Ekim–Aralık için tarih üretmez** (kaynaklar çelişkili) → elle girilir.
- `periodForMonth`, `dueDay`, `eDefterPeriodLabel`.

## Kullanım senaryoları

| Servis | Metot | Not |
|---|---|---|
| `DeclarationsService` | `control`, `syncFromGib`, `importTables`, `markFiled`, `unmark`, `obligations`, `setObligations`, `ensureDefaultObligations` | `importTables` data-intake için (Customer/Supplier) |
| `EDefterService` | `control`, `companies`, `settings`, `update` | |

Altyapı: `declaration-table-parser.ts` (GİB tablo tanıma — ACL), `gib-source.ts` (`MockGibSource` deterministik demo; `LiveGibSource` açık hata verir).

## HTTP uçları

| Metot | Yol | Not |
|---|---|---|
| GET | `/api/declarations/control?month=` | varsayılan önceki ay |
| POST | `/api/declarations/sync?month=` | demo GİB |
| POST / DELETE | `/api/declarations` · `/:id` | elle işaret / geri al |
| GET / PUT | `/api/companies/:id/obligations` | |
| GET | `/api/edefter/control?month=`, `/api/edefter/companies` | |
| PUT | `/api/edefter/companies/:id`, `/:id/berats/:period` | |

## Olaylar

Yayınlamaz. Dışa açtığı API (`index.ts`): `DeclarationsService`, `EDefterService`, `defaultBeratMonth`, `DECLARATION_INFO`, `parseControlMonth`, `periodLabel`, `mapDeclarationHeaders` (Published Language — tebligat kullanır). Tüketiciler: workspace, notifications, data-intake, tebligat.

## Testler

`domain/declaration-rules.spec.ts` (son günler, hafta sonu kayması, çeyrek/yıllık, durumlar), `domain/edefter-rules.spec.ts`, `infrastructure/declaration-table-parser.spec.ts` · e2e `test/taxpayers-tax-filing.e2e-spec.ts` (yükümlülük, matris, işaret/geri al, GİB senkronu idempotent, e-Defter ayar/berat/override, başka büro 404), `test/sgk-tebligat-intake.e2e-spec.ts` (eklenti aktarımı elle kaydı değiştirir).

## Bilinen sınırlar ve genişletme

Resmi tatiller ve GİB süre uzatımları yok → `TaxCalendarEvent` beslenip `expectedForMonth`'a katılmalı (yol haritası). Canlı GİB kaynağı kararı bekliyor (robot yerine eklenti tercih edildi).
