# Bounded context'ler

## Context haritası

```
                       ┌────────────┐
                       │  identity  │  (upstream: herkes guard/CurrentUser'ı buradan alır)
                       └─────┬──────┘
         ┌───────────────────┼──────────────────────────────┐
   ┌─────▼─────┐      ┌──────▼──────┐                 ┌──────▼─────┐
   │  billing  │─────►│  taxpayers  │◄────────────────│ data-intake│ (ACL: GİB/SGK sayfa tabloları)
   │ (kota)    │      │ (çekirdek)  │                 └──┬───┬───┬─┘
   └─────┬─────┘      └──────┬──────┘                    │   │   │
         │        ┌──────────┼─────────────┬─────────────┘   │   │
         │  ┌─────▼─────┐ ┌──▼──────┐ ┌────▼──────────┐ ┌────▼───▼──┐ ┌──────────┐
         │  │tax-filing │ │tebligat │ │social-security│ │ invoicing │ │ payroll  │
         │  └─────┬─────┘ └──┬──────┘ └───┬───────────┘ └─────┬─────┘ └────┬─────┘
         │        │ events   │ events     │ events             │            │ (e-Bildirge query)
         ▼        ▼          ▼            ▼                    ▼            ▼
   ┌───────────────────┐        ┌──────────────────────────────────────────────┐
   │   notifications   │        │ workspace (okuma modeli: inbox/dashboard/rapor)│
   └───────────────────┘        └──────────────────────────────────────────────┘
   documents (dilekçe) ── taxpayers'ı okur      assistant ── bağımsız (yalnız identity)
```

## Context'ler

| Context | Sorumluluk | Aggregate / tablo | Yayınladığı event | Dinlediği |
|---|---|---|---|---|
| `identity` | Büro politikası, kullanıcı, oturum, 2FA, eklenti anahtarı | `Tenant` (güvenlik politikası), `User`, `Session`, `ApiToken` | `identity.user.disabled` | — |
| `billing` | Lisans, kota, ödeme (iyzico) | `Subscription`, `Payment`, `Tenant` fatura bilgileri | `billing.payment.settled` | — |
| `taxpayers` | Mükellef kartı, Excel aktarımı | `Company` | `taxpayers.company.created` | — |
| `tax-filing` | Beyanname yükümlülükleri ve kontrol matrisi, son günler, e-Defter berat, vergi takvimi | `CompanyObligation`, `Declaration`, `EDefterBerat`, `TaxCalendarEvent` | `tax-filing.declarations.imported` | — |
| `tebligat` | e-Tebligat, tebliğ sayılma (VUK 107/A), büro içi inceleme | `ETebligat` | `tebligat.imported` | — |
| `social-security` | SGK işyeri, Vizite e-rapor, 4A giriş/çıkış, e-Bildirge, kurum şifreleri | `SgkWorkplace`, `SgkReport`, `EmploymentEvent`, `EBildirgeDocument` | `sgk.report.received`, `sgk.sync.failed` | — |
| `invoicing` | UBL-TR aktarımı, KDV ön kontrol | `Invoice` | — | — |
| `payroll` | Bordro aktarımı, satır kontrolleri, e-Bildirge mutabakatı | `PayrollRun`, `PayrollLine` | — | — |
| `documents` | Dilekçe şablonları ve arşiv | `PetitionTemplate`, `Petition` | — | — |
| `assistant` | Mevzuat asistanı, redaksiyon, kota | `AssistantConversation`, `AssistantMessage` | — | — |
| `notifications` | Uygulama içi bildirim, WhatsApp, hatırlatıcılar | `Notification`, `NotificationRead`, `NotificationDelivery` | — | yukarıdaki tüm bildirim eventleri |
| `workspace` | İş kutusu, dashboard, CSV raporlar | `InboxSnooze` | — | — (query facade'ları kullanır) |
| `data-intake` | Eklenti sayfa aktarımı → context komutları | — | — | — |
| `sales` (ayrı uygulama: `satis/api`) | Satış ekibi: müşavir (büro) hesabı açma, lisans, dondurma, şifre/2FA sıfırlama | `SalesUser`, `SalesAccount`, `SalesAuditLog`; `Tenant`/`User`/`Subscription`'a ayrı DB rolüyle yazar | — | — |

Altyapı (`platform`) ve `shared-kernel` context değildir; bkz. `architecture.md`.

## Önemli iş kuralları (nerede yaşar)

- Beyanname son günleri, durumlar (Verildi / Geç / Bekliyor / Gecikti): `tax-filing/domain/declaration-rules.ts`
- e-Defter son günleri (Ekim–Aralık elle): `tax-filing/domain/edefter-rules.ts`
- Tebliğ sayılma = ulaşmayı izleyen 5. gün sonu: `tebligat/domain`
- İş kutusu öğeleri, önem derecesi, sıralama: `workspace/domain/inbox-items.ts`
- Paket/fiyat, süre uzatma, kuruş yuvarlama: `billing/domain/plans.ts`
- Bordro satır kontrolleri (%14 SGK, %1 işsizlik, ≤30 gün): `payroll/domain`
- TOTP (RFC 6238): `identity/domain/totp.ts`
- PII maskeleme (LLM'e gitmeden): `assistant/domain/redact.ts`

## Ubiquitous language — TR ↔ EN sözlük

| Türkçe (UI, doküman) | Kod | Not |
|---|---|---|
| Büro (mali müşavirlik bürosu) | `Tenant` | Müşteri / kiracı |
| Mükellef, firma | `Company` (context: `taxpayers`) | Şirket / şahıs / basit usul (`CompanyType`) |
| VKN / TCKN | `taxNumber` (`TaxNumber` VO) | 10 / 11 hane, TCKN kontrol haneli |
| Yükümlülük | `CompanyObligation` | Firmanın vermesi gereken beyanname türleri |
| Beyanname | `Declaration` | KDV1, MUHSGK, DAMGA, GECICI_VERGI, YILLIK_GELIR, KURUMLAR |
| Dönem | `period` (`Period` VO) | `2026-09`, `2026-Q3`, `2026` |
| Tahakkuk | `accrualAmount` | |
| Son gün | `dueDate` | Hafta sonu → ilk iş günü |
| Berat (e-Defter) | `EDefterBerat` | Aylık / dönemsel yükleme tercihi |
| e-Tebligat, tebliğ sayılma | `ETebligat`, `deemedServedAt` | |
| İşyeri, sicil no | `SgkWorkplace`, `registryNo` | Şube = `isBranch` |
| Vizite, e-Rapor, çalışmazlık onayı | `SgkReport`, `approve` | Sağlık verisi — özel nitelikli |
| İşe giriş / işten ayrılış (4A tescil) | `EmploymentEvent` ENTRY/EXIT | |
| e-Bildirge (APHB) | `EBildirgeDocument` | Asıl / ek / iptal = `kind` |
| PEK (prime esas kazanç) | `premiumBase` / `sgkBase` | |
| Bordro | `PayrollRun` / `PayrollLine` | |
| Fatura, ETTN | `Invoice`, `uuid` | UBL-TR |
| Dilekçe | `Petition` | |
| İş kutusu, sonra hatırlat | `workspace` inbox, `InboxSnooze` | |
| Uzmana Sor | `assistant` | |
| Eklenti anahtarı | `ApiToken` | kapsam `gib:import` |
| Kasa | `platform/crypto` | Kurum şifreleri |
| Denetim kaydı | `AuditLog` | Değiştirilemez |
