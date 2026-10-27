<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->
[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **Mimari**
<!-- /gezinti -->

# Mimari

> Kısa özet. Ayrıntı: [01 genel bakış](../hedef-mimari/01-cok-kiracili-hedef-mimari.md), [02 kurum entegrasyonu](../hedef-mimari/02-kurum-entegrasyon-robotu.md), [05 yetki](../hedef-mimari/05-yetki-ve-hesap-modeli.md), [06 kaynak kod](../hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md), [07 veri ve sharding](../hedef-mimari/07-veri-saklama-ve-sharding.md). Örnekli DDD uygulama rehberi: [gelistirici-rehberi/ddd.md](../gelistirici-rehberi/ddd.md).

## Bileşenler

| Bileşen | Yer | Teknoloji |
|---|---|---|
| Portal + BFF | `apps/web` | Next.js App Router; oturum Redis'te, `__Host-` HttpOnly çerez |
| Satış portalı | `apps/sales` | Next.js, ayrı imaj, `eworks_sales` DB rolü (D40) |
| İşçi | `apps/worker` | Node: outbox yayıncı, gece planlayıcı, entegrasyon sonucu uygulayıcı, temizlik |
| Kurum entegrasyonu (ACL) | `services/integration` | Python 3.12: web servis istemcileri, Playwright robotu (yedek), ayrıştırma → `contracts/` |
| OCR | `services/ocr` | CAPTCHA çözümü (D6) |
| Veri | `supabase/` | On-prem Supabase: PostgreSQL (kontrol düzlemi + kiracı shard'ları, Vault), GoTrue. Uygulama shard'a doğrudan `pg` ile bağlanır, RLS JWT claim'leriyle (D34) |
| Nesne deposu | `deploy/compose` | S3 uyumlu; Compose'da SeaweedFS (D35): beyanname/SGK PDF'leri, ham sonuçlar |
| Kuyruk, hız sınırı | — | RabbitMQ (durum kaynağı Postgres `jobs`), Redis GCRA |

## Bounded context'ler

| Context | Sorumluluk |
|---|---|
| `identity-access` | Kullanıcı, oturum, MFA, yetki ağacı, rol şablonları, kişiye özel izin, personel ataması |
| `organization` | Ofis, müşavir, üyelik, davet |
| `portfolio` | Mükellef kartı, müşavir bağı (tek müşavir, D16), mükellef kullanıcıları, devir |
| `credentials` | Kurum hesabı, Vault, kullanım izni, mükellef onayı, kilitlenme koruması |
| `sync` | Entegrasyon kaydı, taşıma yolu, iş planlama, istek bütçesi, iş/adım durumu, sonuç dağıtımı |
| `tax-filing` | e-Beyanname sözleşmeleri, beyannameler, tahakkuklar, son gün kuralları |
| `social-security` | SGK işyeri, e-Bildirge, işe giriş/çıkış, e-Rapor (sağlık verisi), iş kazası, kontrol listesi |
| `documents` | PDF metaverisi, saklama (vars. 7 gün, D15), toplu temizlik |
| `workspace` | Görev, not, uyarı, kontrol listeleri (okuma modeli), mali müşavir takvimi, kişisel hatırlatma, portal kısayolları |
| `notices` | e-Tebligat (GİB; ileride UETS): yalnız liste bilgisi, belge açılmaz (D45) |
| `notifications` | Portal ve e-posta bildirimleri |
| `audit` | Değiştirilemez denetim kaydı |
| `sales` | Satış portalı: hesap açma, sözleşme ve mükellef onayı, dondurma, shard ataması; iş verisini görmez |
| `integration` (Python) | ACL; alan modeli yok, yayımlanmış dil üretir |

Bağlam sayfaları: [docs/baglamlar/](../baglamlar/README.md). Bugünkü portalın e-Defter, fatura, dilekçe, ödeme ve rapor ekranları henüz bir bağlama atanmadı (açık konu).

## Katmanlar ve bağımlılık yönü

`domain` ← `application` ← `infrastructure` / UI. Bağlamlar birbirine yalnız `src/index.ts` (facade + olay tipleri + yetki anahtarları) ve olaylarla erişir. Rota ince; BFF ucu oturum + CSRF + yetki anahtarı + firma kapsamı denetler ve use-case çağırır; iş kuralı use-case ve domain'dedir. Python ACL ham kurum verisini `contracts/` diline çevirir; tablolara `apps/worker`'daki application katmanı uygular. Kurallar `tools/arch/dependency-cruiser.cjs` ile zorlanır (`pnpm arch`).

## Veri, kiracılık ve sharding

- **Kontrol düzlemi** (ofis kaydı, shard eşlemesi, VKN tekilliği, satış hesapları) + `org_id` ile **kiracı shard'ları** (16 mantıksal / 2 fiziksel başlangıç önerisi); shard içinde zamana göre bölümleme (D24).
- Her bağlamın kendi Postgres şeması; kiracı tablolarında PK `(org_id, id)` ile başlar; RLS her tabloda, yardımcılar `app` şemasında. Başka bağlamın tablosuna sorgu yok.
- İş verisi **10 yıl** saklanır (D23); PDF'ler varsayılan 7 gün.

## Kurum entegrasyonu

- Web servis birincil, robot yedek (D19); `integrations.primary_transport`, `fallback_policy` (vars. `manual`), ortak hız bütçesi.
- Kapasiteyi CPU değil **istek bütçesi** belirler: başlangıç 60 istek/dk (D25), hatasızken artar, bağlantı hatasında yarıya iner + devre kesici (D11). Çıkış IP'si sabit ve kayıtlıdır (D14).
- CAPTCHA otomatik (sunucu OCR, D6); `wrong_password` alan hesap bir daha denenmez.

## Yetki

Yetki ağacı = özellik ağacı (`packages/feature-registry`): modül → sayfa → işlem, miras + açık engelleme. Etkin yetki = rol şablonu (`ofis_admin`, `musavir`, `personel`, `mukellef`) ∪ kişiye özel izin − engel. İşlem için: etkin yetki **ve** kapsam içindeki firma **ve** (kurum hesabı kullanılıyorsa) hesap kullanım hakkı (05 §3).

## Ortak dil (TR ↔ kod)

| Türkçe | Kod | Türkçe | Kod |
|---|---|---|---|
| Ofis | `Organization` | Kurum hesabı | `InstitutionAccount` |
| Mali müşavir | `Advisor` | Kullanım izni | `CredentialGrant` |
| Personel | `Staff` | Mükellef onayı | `CredentialConsent` |
| Mükellef | `Taxpayer` | Senkron işi / adımı | `SyncJob` / `SyncStep` |
| Mükellef kullanıcısı | `TaxpayerUser` | İstek bütçesi, hız politikası | `RequestBudget`, `RatePolicy` |
| Müşavir devri | `AdvisorTransfer` | e-Beyanname sözleşmesi | `FilingContract` |
| VKN / TCKN | `TaxId` | Beyanname, tahakkuk | `Declaration`, `Accrual` |
| Dönem | `Period` | İşyeri (SGK) | `Workplace` |
| Kurum | `Institution` | e-Bildirge / işe giriş-çıkış / e-Rapor / iş kazası | `EBildirgeDocument` / `EmploymentEvent` / `SickLeaveReport` / `WorkAccident` |
| Yetki anahtarı | `PermissionKey` | Özellik durumu | `FeatureStatus` (`red`/`green`) |
| Takvim kaydı | `CalendarEntry` | Kişisel hatırlatma | `Reminder` |
| SGK işyeri hesabı | `InstitutionAccount` (`institution: SGK`, `label`) | Kurum hesabının canlı durumu | `LiveStatus` |

<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->

---

[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › **Mimari**
<!-- /gezinti -->
