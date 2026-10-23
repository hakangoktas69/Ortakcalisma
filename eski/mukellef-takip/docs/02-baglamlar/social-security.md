# social-security ★

> Alt alan: **Çekirdek** · Kod: `apps/api/src/modules/social-security/` · Şema: `prisma/schema/social-security.prisma` · Kalıp: **ACL** (SGK SOAP)

## Sorumluluk

SGK işyerleri ve **kurum şifreleri**, Vizite e-raporları (çalışmazlık onayı dahil), 4A işe giriş/çıkış kayıtları, e-Bildirge (aylık prim ve hizmet belgesi) aktarımı; gece senkronu.
**Yapmaz:** 4A bildirge göndermez (yalnız okuma — yasal bağlayıcılık); bordro hesaplamaz.

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `SgkWorkplace` | `id`; `registryNo` | Kurum şifreleri yalnız **kasada şifreli** (`viziteSecretEnc`, `tescil*PasswordEnc`), API yanıtında asla dönmez; kaydetmeden önce SGK'da denenir; her çözme denetim kaydı |
| `SgkReport` (e-rapor) | (`workplaceId`, `medulaRaporId`) | **Sağlık verisi**: kimlik alanları şifreli (`tcknEnc`, `fullNameEnc`, `tcknHash`), ham SGK satırı saklanmaz · onaylı rapor tekrar `PENDING`'e dönmez · SGK'da "okundu" kapatma **kayıt başarılı olduktan sonra** |
| `EmploymentEvent` (4A) | (`workplaceId`, `type`, `tcknHash`, `eventDate`) | Kimlik şifreli; tekillik T.C. özetiyle |
| `EBildirgeDocument` | (`workplaceId`, `period`, `documentType`, `lawNo`, `kind`) | Aynı belge değişmediyse atlanır, değiştiyse güncellenir |

## İş kuralları

- `application/ports/vizite.types.ts`: `ViziteError.isAuthError` (105/106), `isEmpty` (503/505 → boş liste), `toSgkDate` / `parseSgkDate`, `VAKA_ADI`.
- `infrastructure/ebildirge-parser.ts`: dönem (`2026/09` veya yıl+ay), belge türü 2 hane, kanun no 5 hane, mahiyet `ASIL/EK/IPTAL`, `sameRegistry` (sicil biçim eşdeğerliği).
- İşyeri eşleştirme sırası: satırdaki sicil → kullanıcının girdiği sicil → sayfa metnindeki ipucu (tek işyerine uyuyorsa) → yoksa `needsWorkplace` (hiçbir şey yazılmaz).

## Kullanım senaryoları

| Servis | Metot | Not |
|---|---|---|
| `ViziteSyncService` | `testLogin`, `syncWorkplace`, `approveReport` | `approveReport` **kuruma yazar**: yalnız kullanıcı isteğiyle; şifreli T.C. çözülür; denetim kaydı |
| `TescilSyncService` | `verify`, `syncWorkplace` | ilk senkron yılbaşından, sonra son senkron −7 gün |
| `EBildirgeService` | `importTables`, `list` | data-intake için |
| `SgkSyncService` | `enqueueAll`, `syncWorkplace` | kuyruğa alma (API'de de çalışır) |

Altyapı (ACL): `SoapViziteClient` (SOAP 1.1, `parseTagValue:false` — kimlik numaraları metin kalır), `MockViziteClient` (şifre `hatali` → 105), `LiveTescilClient` (kılavuz gelene kadar bilinçli hata), `MockTescilClient`, `SgkSyncProcessor` (**yalnız worker**: gece 02:00, eşzamanlı 2, dakikada 20, 3 deneme). Seçim `SGK_MODE=mock|live`.

## HTTP uçları

| Metot | Yol | Not |
|---|---|---|
| GET / POST | `/api/sgk/workplaces` | liste şifre döndürmez |
| PUT / DELETE | `/api/sgk/workplaces/:id/vizite-credentials`, `/tescil-credentials` | önce SGK'da denenir |
| POST | `/api/sgk/sync?workplaceId=` | tek işyeri hemen; parametresiz → kuyruk |
| GET | `/api/sgk/reports?status=`, `/employment?type=&days=`, `/ebildirge?months=&period=&workplaceId=` | T.C. maskeli; `pii.read` denetim kaydı |
| POST | `/api/sgk/reports/:id/approve` `{ nitelikDurumu, tarih }` | kuruma yazar |

## Olaylar

Yayınlar: `sgk.reports.received` `{ workplaceId, companyTitle, count, names[≤3] }` → notifications (dış kanala isim gitmez). Dışa açtığı: `SocialSecurityModule`, `SocialSecurityWorkerModule`, `EBildirgeService`, olay tipi.

## Güvenlik ve KVKK

En hassas bağlam: kurum şifresi (S0) + sağlık verisi (S1). Kurallar: [Güvenlik mimarisi](../04-mimari/03-guvenlik-mimarisi.md).

## Testler

`infrastructure/vizite/soap-vizite.client.spec.ts` (zarf, kaçış, dizi/tekil yanıt, hata kodları, Fault, HTTP), `infrastructure/ebildirge-parser.spec.ts` · e2e `test/sgk-tebligat-intake.e2e-spec.ts` (şifre saklama, senkron + şifreli yazım, maskeli yanıt, onay ve idempotentlik, e-Bildirge eşleştirme), `test/worker.e2e-spec.ts` (kuyruk işleyici).

## Bilinen sınırlar

Canlı Vizite pilot işyerinde doğrulanmadı; 4A canlı istemci SGK kılavuzunu bekliyor; e-Bildirge sayfa başlıkları canlı görülmedi.
