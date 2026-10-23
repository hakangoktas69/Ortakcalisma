# 3.2 Taktiksel yapı taşları

> Üst: [Katmanlar](01-katmanlar.md) · İlgili: [Ortak dil](../01-stratejik-tasarim/02-ortak-dil.md)

Bu projede DDD yapı taşları **pragmatik** uygulanır: TypeScript'te sınıf hiyerarşisi yerine *saf fonksiyonlar + tipler* tercih edilir, kalıcılık için ayrı repository sınıfı yerine Prisma (RLS ile korunan) application katmanında kullanılır. Aşağıdaki tablo her kavramın **bu kod tabanındaki karşılığını** gösterir.

| DDD kavramı | Bu projedeki biçimi | Örnek |
|---|---|---|
| **Entity** | Prisma modeli (kimliği `id`) | `Company`, `Declaration`, `ETebligat`, `Payment` |
| **Aggregate / kök** | Birlikte tutarlı tutulan satırlar; dışarıdan yalnız kök üzerinden değişir | `PayrollRun` + `PayrollLine`; `Subscription` + `Payment` geçişi |
| **Value object** | Değişmez, kimliksiz tip veya doğrulanmış ilkel + saf fonksiyon | `Period` (`"2026-09"`, `"2026-Q3"`, `"2026"`), TCKN (`isValidTckn`, `maskTckn`), tutar (`roundKurus`) |
| **Domain servisi** | Birden çok entity'yi ilgilendiren saf hesap | `expectedForMonth`, `statusOf`, `extendExpiry`, `severityForDue` |
| **Domain olayı** | `domain/events.ts`'te sabit ad + yük tipi | `TEBLIGAT_IMPORTED` / `TebligatImported` |
| **Repository** | Prisma istemcisi (RLS + tenant bağlamı ile) — ayrı sınıf yok | `this.prisma.eTebligat.findMany(...)` |
| **Application servisi** | Nest `@Injectable()` servis; bir metot = bir kullanım senaryosu | `TebligatService.importTables`, `BillingService.markPaid` |
| **Port** | `application/ports/*.ts` arayüzü + `infrastructure` uygulaması | `ViziteClient` → `SoapViziteClient` / `MockViziteClient` |
| **Anti-corruption layer** | Dış biçimi iç modele çeviren ayrıştırıcı/istemci | `tebligat-parser.ts`, `ubl-parser.ts`, `iyzico.client.ts` |
| **Factory** | `seal()`, `fill()` gibi kurallı oluşturucular | `PersonalDataService.seal`, `fill(template, values)` |
| **Specification** | Saf yüklem fonksiyonu | `isAllowedImportHost`, `statusOf` |

## Neden ayrı repository sınıfı yok?

Kararı [ADR 0002](../adr/0002-ddd-katmanlari.md) açıklar; özet:
- Prisma zaten tipli bir veri erişim katmanıdır; üzerine bire bir sarmalayıcı yazmak kod tekrarı üretir.
- **Kiracı yalıtımını repository değil veritabanı (RLS) sağlar** — unutulan bir `where tenantId` veri sızdırmaz ([04-tutarlilik](04-tutarlilik.md), [05-capraz-kesen-konular](05-capraz-kesen-konular.md)).
- Kurallar saf fonksiyonlarda olduğu için Prisma'yı taklit etmeden test edilir.

**Ne zaman port + adaptör yazılır?** Dış sistem (SGK SOAP, iyzico, Meta, Claude) veya test/dev'de değiştirilecek bir uygulama varsa: `mock | live` modları, sahte sunucuya karşı e2e testi. Bir Prisma tablosunu okumak için port yazılmaz.

## Değer nesneleri ve doğrulama

| VO | Nerede | Kural |
|---|---|---|
| TCKN | `shared-kernel/tckn.ts` | 11 hane, ilk hane ≠ 0, iki kontrol hanesi; ekranda `123*****901` |
| VKN | `taxpayers` (DTO + `company-import.ts`) | 10 hane; şahıs firması 11 haneli TCKN ile çalışabilir |
| Dönem | `tax-filing/domain/declaration-rules.ts` | Aylık `YYYY-MM`, üç aylık `YYYY-Qn`, yıllık `YYYY`; `periodLabel` |
| Tutar | `shared-kernel/money.ts` | Kuruş yuvarlaması ondalık gösterimle (1.005 → 1.01) |
| Tablo metni | `shared-kernel/table-text.ts` | Türkçe büyük/küçük harf, boşluk, tarih/sayı ayrıştırma (`1.234,56`) |
| Maskeli metin | `shared-kernel/pii-redact.ts` | TCKN, VKN, IBAN, sicil, telefon, e-posta → `[TCKN]` vb. |

**Kural:** Doğrulama sınırda iki kez yapılır — DTO'da biçim (class-validator), domain'de anlam (kontrol hanesi, dönem geçerliliği). Veritabanı kısıtları (benzersizlik, FK) üçüncü savunmadır; ihlalleri `PrismaExceptionFilter` 409/404'e çevirir.

## Aggregate sınırları ve değişmezler

| Aggregate | Değişmez | Nasıl korunur |
|---|---|---|
| `Payment` | `PENDING → PAID` en fazla bir kez | Koşullu `updateMany({ where: { status: 'PENDING' } })`, `count === 0` ise zaten işlenmiş |
| `PayrollRun` | Satırlar ve toplamlar birlikte | Tek `$transaction` içinde koşu + satırlar |
| `Declaration` | (mükellef, tür, dönem) tekil | Benzersiz indeks + upsert |
| `Notification` | (büro, `dedupeKey`) tekil | Benzersiz indeks; olay için `event:<outboxId>` |
| `ETebligat` | (mükellef, belge no) tekil | Benzersiz indeks; tekrar aktarım yalnız `readAtGib` günceller |
| `Session` | Bir refresh token yalnız bir kez kullanılır | Dönüşte eski token iptal; tekrar kullanım → **tüm aile** iptal |

Bir aggregate'in iki parçası farklı istekte değişiyorsa ya aynı transaction'a alınır ya da değişmez *olay* ile sonradan sağlanır (nihai tutarlılık). Ayrıntı: [Tutarlılık](04-tutarlilik.md).

## İsimlendirme

- Kod tanımlayıcıları İngilizce, kullanıcıya görünen metin ve yorumlar Türkçe; alan terimleri ortak dildeki karşılıklarıyla ([sözlük](../01-stratejik-tasarim/02-ortak-dil.md)).
- Olay adı `<context>.<geçmiş zaman fiil>`: `tebligat.imported`, `billing.license.extended`.
- Dosya adları kebab-case, `.js` uzantılı ESM importları (`./x.js`).
