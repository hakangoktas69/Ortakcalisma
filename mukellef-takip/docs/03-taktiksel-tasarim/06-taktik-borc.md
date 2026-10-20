# 3.6 Taktik borç ve iyileştirme listesi

> İlgili: [Yol haritası](../ai/roadmap.md) (faz planı), [Bağlam haritası](../01-stratejik-tasarim/03-baglam-haritasi.md)

DDD geçişi "strangler" yöntemiyle yapıldı: davranış ve HTTP sözleşmeleri korunarak kod bağlamlara taşındı. Aşağıdakiler bilinçli bırakılan veya sonradan tespit edilen sapmalardır. **Kural:** bir dosyaya başka bir iş için dokunuyorsan, o dosyadaki maddeyi de kapatmayı düşün ve bu listeden sil.

Önem: 🔴 veri kaybı/güvenlik riski · 🟠 model bütünlüğü · 🟢 temizlik

## 1. Tutarlılık

| # | Önem | Sorun | Yer | Çözüm |
|---|---|---|---|---|
| 1.1 | 🔴 | Olay, verinin yazıldığı transaction'ın **dışında** yazılıyor; arada süreç çökerse bildirim kaybolur | `tebligat/application/tebligat.service.ts` (`importTables`), `social-security/application/vizite-sync.service.ts` | Yazma + `outbox.publish(..., tx)` aynı `$transaction`'a. Vizite'de rapor başına upsert + olay transaction'ı, `markRead` sonrasında |

## 2. Kuralların yanlış katmanda olması

| # | Önem | Sorun | Yer | Hedef |
|---|---|---|---|---|
| 2.1 | 🟠 | KDV kovaları (indirilecek/hesaplanan, tevkifat) saf hesap ama application'da | `invoicing/application/invoices.service.ts` `kdvBuckets` | `invoicing/domain/vat.ts` |
| 2.2 | 🟠 | Bordro toplamları ve e-Bildirge mutabakatı saf hesap ama application'da | `payroll/application/payroll.service.ts` `payrollTotals`, `reconcile` | `payroll/domain/` |
| 2.3 | 🟠 | Tebliğ sayılma tarihi (iş kuralı: teslimden 5 gün sonu) ayrıştırıcıda | `tebligat/infrastructure/tebligat-parser.ts` `deemedServedDate` | `tebligat/domain/` (ayrıştırıcı onu çağırır) |
| 2.4 | 🟢 | `taxpayers` bağlamında `domain/` ve `application/` yok; controller Prisma'yı doğrudan kullanıyor | `taxpayers/interface/http/companies.controller.ts` | `CompaniesService` + VKN/TCKN değer nesnesi + kota kuralı domain'e |
| 2.5 | 🟢 | Controller'da sorgu birleştirme | `workspace/interface/http/{dashboard,reports}.controller.ts`, `identity/.../users.controller.ts`, `notifications/.../notifications.controller.ts`, `social-security/.../sgk.controller.ts` | Application servisine taşı (controller yalnız DTO + çağrı) |

## 3. Bağlam sınırı (başka bağlamın tablosunu okuma)

Import düzeyinde ihlal yok (`arch:check` temiz); ancak Prisma ile şu tablolar sahibi olmayan bağlamlarca okunuyor. Her biri için sahibin `index.ts`'ine **sorgu facade'ı** eklenip ona geçilmeli:

| Okuyan | Okunan tablo(lar) | Sahibi |
|---|---|---|
| `workspace` | `sgkReport`, `employmentEvent`, `sgkWorkplace` | social-security |
| `workspace` | `subscription` | billing |
| `workspace` | `eTebligat` (raporlar), `taxCalendarEvent` (dashboard) | tebligat, tax-filing |
| `notifications` | `eTebligat` (hatırlatıcı), `user` (alıcılar) | tebligat, identity |
| `payroll` | `sgkWorkplace`, e-Bildirge belgeleri | social-security |
| `taxpayers` | `subscription` (kota) | billing |
| `assistant`, `documents` | `user` (ad soyad) | identity |

Bilinçli serbest: `company` ve `tenant` tablolarına salt okuma JOIN'leri (her bağlamın büro kapsamına ihtiyacı var).

## 4. Güvenlik ve KVKK

| # | Önem | Sorun | Çözüm / durum |
|---|---|---|---|
| 4.1 | 🔴 | Web erişim belirtecini `localStorage`'da tutuyor (XSS ile çalınabilir) | Faz 3: BFF + `HttpOnly; Secure; SameSite=Strict` çerez ([ADR 0006](../adr/0006-bff-cerez-oturum.md)); API tarafı (oturum, dönen refresh) hazır |
| 4.2 | 🔴 | Düz `tckn` / `fullName` / `raw` kolonları şemada duruyor (geçiş için) | Tüm kurulumlarda `personal-data.backfill` bitince kolonları kaldıran migration |
| 4.3 | 🟠 | Anahtar rotasyonu sonrası eski sürümle şifreli kayıtları yeniden şifreleyen iş yok | `VaultService.needsRotation` hazır; worker işi yazılacak |
| 4.4 | 🟠 | Saklama süresi / imha işi yok (KVKK md.7) | Bağlam başına süreler hukukçuyla; worker zamanlanmış iş + denetim kaydı |
| 4.5 | 🟠 | İlgili kişi talebi (KVKK md.11: dışa aktar/sil) aracı yok | Yönetici ekranı + API |
| 4.6 | 🟢 | Nonce'lu CSP yok (şu an statik başlıklar) | Faz 3 |

## 5. Paylaşılan sözleşmeler

| # | Önem | Sorun | Çözüm |
|---|---|---|---|
| 5.1 | 🟠 | Web, API tiplerini elle kopyalıyor; mobil gelince üçe katlanır | `packages/contracts` (DTO, enum, olay yükleri) — Faz 3 başı |

## Kapatma yöntemi

1. Davranışı koruyan testi önce yaz/doğrula (bağlamın e2e testi yoksa ekle).
2. Kodu taşı; `npm run arch:check -w api` ve `npm run verify` yeşil.
3. Bağlam sayfasındaki "Bilinen sınırlar" bölümünü ve bu listeyi güncelle; büyük kararsa ADR.
