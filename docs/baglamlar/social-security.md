<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **social-security**
<!-- /gezinti -->

# social-security — SGK

> Durum: **F aşaması (2026-10-25)**: MUHSGK beyannamelerinin SGK bildirimleri (işyeri × ay, durum, tekil çalışan sayısı, SGK tahakkuk ve hizmet listesi PDF'leri), e-Bildirge ekranı ve SGK kontrol listesi. Kaynak eski portaldaki gibi GİB e-Beyanname içindeki "SGK Bildirimleri"dir; SGK'nın kendi sistemleri (e-Bildirge V2, işe giriş/çıkış, e-Rapor, iş kazası) henüz bağlanmadı. Kaynak: [06 §2](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#2-bounded-context-haritası-ve-ortak-dil). Kod: `packages/contexts/social-security` — dışarıya yalnız `src/index.ts`.

| | |
|---|---|
| Sorumluluk | SGK işyeri, e-Bildirge, işe giriş/çıkış, e-Rapor (sağlık verisi), iş kazası, kontrol listesi |
| Aggregate'ler (kök) | `EBildirgeDocument` (tablo `social_security.workplace_filings`); `Workplace`, `EmploymentEvent`, `SickLeaveReport`, `WorkAccident` henüz yok |
| Yayınladığı olaylar | `SgkDataImported`, `SickLeavePending` (henüz yok) |
| Özellik anahtarları | `sgk.*` |
| Veritabanı şeması | `social_security` (shard) |

## Kurallar

- Kaynak: e-Beyanname sorgusundaki MUHSGK satırının "SGK Bildirimleri" penceresi (eski robotun `muhsgk_sgk_reader`'ı). Robot önce aynı oturumda sözleşme listesini okur; yalnız Aracılık ve Sorumluluk sözleşmeli mükellefler sorgulanır ([tax-filing.md](tax-filing.md)).
- Satır kuralları (`domain/filing.ts`): işyeri sicil numarası 17–30 hane, dönem MUHSGK dönemi içinde, satır kimliği tekil, "Vergi" satırı atlanır. Tek bozuk satır o MUHSGK'nın tüm SGK satırlarını geçersiz kılar (fail-closed); beyanname yine yazılır.
- Kontrolün `onclick`'i MUHSGK ve SGK satır kimlikleriyle tam eşleşmezse robot hiçbir eylem çalıştırmaz; tanınmayan kontrol varsa liste durdurulur.
- **Çalışan sayısı** hizmet listesi PDF'indeki tablodan tekil TCKN sayılarak çıkarılır (eski `sgk_employee_count`). TCKN ve ad **ACL'den dışarı çıkmaz** (KVKK); tablo tanınmazsa sayı uydurulmaz (`null`).
- İşyeri sicil numarası ekranda kısaltılır (ilk 4 + son 4 hane).
- Kayıt yalnız işçide (sistem bağlamı), okuma firma kapsamında (RLS). PDF'ler documents bağlamında, konu `sgk_filing`; indirme yetkisi `sgk.ebildirge.download` ([documents.md](documents.md)).
- Kontrol listesi: mükellef × son 6 dönem; hücrede toplam çalışan (bir işyerinin sayısı bilinmiyorsa toplam da bilinmez), onay bekleyen bildirim sarı.

## BFF uçları ve ekranlar

- `/sgk/ebildirge` + `POST /api/sync/muhsgk` (iş türü `gib.muhsgk`: yalnız SGK tahakkuk + hizmet listesi indirilir), `/sgk/kontrol`.
- Beyanname senkronu (`gib.beyannameler`) da MUHSGK'ların SGK bildirimlerini alır.

## Testler

- Birim: `test/application/filings.test.ts`; işçi: `apps/worker/test/uygulayici.test.ts` (MUHSGK sonucu).
- Python ACL: `services/integration/tests/test_beyanname.py` (SGK penceresi, iki PDF, çalışan sayısı, sonuçta kişi bilgisi olmadığı).
- pgTAP: `supabase/tests/tenant/app/kiraci_tablolari.sql` (kiracı tablosu kuralları, kurum verisini yalnız işçi yazar).
- Kabul: `apps/web/e2e/sgk.e2e.ts`. Yeşil: `sgk.ebildirge.view/download`, `sgk.kontrol.view`. `sgk.ebildirge.sync` canlı GİB kaydı bekliyor (D33).

## Açık işler

- SGK sistemleri: işe giriş/çıkış, e-Rapor (sağlık verisi — ayrı erişim ve maskeleme kuralı gerekir), iş kazası; SGK kurum hesabı (D13).
- Çok sayfalı SGK bildirim listesi canlıda gözlenmedi; robot bugün tek sayfa dışını reddeder.

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [Bağlamlar](README.md) › **social-security**
<!-- /gezinti -->
