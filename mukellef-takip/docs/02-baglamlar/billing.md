# billing

> Alt alan: Genel · Kod: `apps/api/src/modules/billing/` · Şema: `prisma/schema/billing.prisma` · Kalıp: **ACL** (iyzico)

## Sorumluluk

Büro lisansı (süre, paket, firma kotası), fatura bilgileri, ödeme (demo ve iyzico Ödeme Formu).
**Yapmaz:** kart bilgisi almaz (iyzico'nun sayfası); tutarı istemciden kabul etmez.

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `Subscription` | `tenantId` (1:1) | Süre bitmemişse uzatma bitişin üzerine eklenir; ay sonu taşması önlenir (`extendExpiry`: 31 Ocak + 1 ay → 28/29 Şubat) |
| `Payment` | `id`; `providerToken` benzersiz | Tutar **sunucuda** `priceFor(plan, months)` ile · `PENDING → PAID` geçişi yalnız "hâlâ PENDING ise" koşullu güncellemeyle (eşzamanlı geri dönüşler lisansı iki kez uzatamaz) · mevcut firma sayısını karşılamayan paket seçilemez |

## İş kuralları (domain)

`domain/plans.ts`: `PLANS` (baslangic / pro / kurumsal — **fiyatlar örnektir**), `PERIODS` (1/6/12 ay, indirim), `priceFor`, `extendExpiry`; kuruş yuvarlaması `shared-kernel/money.ts` `roundKurus` (kayan nokta hatasına karşı ondalık gösterim).
`infrastructure/iyzico.client.ts` `verdictFromRetrieve()` — **onay koşullarının hepsi**: istek `success`, ödeme `SUCCESS`, `fraudStatus = 1`, sepet ve konuşma no = ödeme no, tahsil edilen tutar ve para birimi beklenenle aynı. `fraudStatus = 0` → beklemede (REVIEW).

## Kullanım senaryoları

`BillingService`: `summary`, `profile`/`saveProfile`, `checkout` (taksit kapalı: taksitte tutar değişir, doğrulama bozulur), `demoConfirm`, `settleIyzico` (oturumsuz geri dönüş: ödeme **sistem bağlamında** token'dan bulunur, kalan işlem o büronun bağlamında), `refresh`, `cancel`, `markPaid` (transaction içinde lisans + **olay**).

## HTTP uçları

| Metot | Yol | Yetki |
|---|---|---|
| GET | `/api/billing` | oturum |
| GET / PUT | `/api/billing/profile` | ADMIN |
| POST | `/api/billing/checkout`, `/payments/:id/demo-confirm`, `/refresh`, `/cancel` | ADMIN |
| POST | `/api/billing/iyzico/callback` | **oturumsuz** — tarayıcıya güvenmez, iyzico'ya sorar, 303 ile portala döner |

## Olaylar

Yayınlar: `billing.license.extended` `{ planName, expiresAt }` — lisans güncellemesiyle **aynı transaction'da** (ödeme işlendiyse bildirim kaybolmaz).

## Güvenlik

Üretimde `BILLING_PROVIDER=demo` reddedilir (lisansı bedavaya uzatır) — `DEMO_MODE=true` tanıtım kurulumu hariç. Anahtarlar Docker secret.

## Testler

`domain/plans.spec.ts`, `infrastructure/iyzico.client.spec.ts` (imza IYZWSv2, fiyat biçimi, karar tablosu) · e2e `test/billing-documents-assistant.e2e-spec.ts` (demo akış, ikinci onay uzatmaz, yetki, geri dönüş), `test/iyzico.e2e-spec.ts` (**sahte iyzico sunucusu**: imzalı istek, başarılı / inceleme / yanlış tutar / başka sepet, eksik fatura bilgisi).

## Bilinen sınırlar

Canlı iyzico üye işyeri başvurusu ve https geri dönüş adresi bekliyor; reddedilen kart senaryosu gerçek sandbox'ta denenmedi.
