# workspace ★

> Alt alan: **Çekirdek (okuma modeli)** · Kod: `apps/api/src/modules/workspace/` · Şema: `prisma/schema/workspace.prisma` · Kalıp: **CQRS okuma tarafı**

## Sorumluluk

Kullanıcının tek bakışlık ekranları: **iş kutusu**, genel bakış (dashboard), CSV raporlar. Diğer bağlamların verisini birleştirir, kendisi neredeyse hiç yazmaz.
**Yapmaz:** kaynak bağlamın kuralını yeniden yazmaz (son günü tax-filing hesaplar, workspace gösterir).

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `InboxSnooze` | (`tenantId`, `key`) | Erteleme **büro genelinde** (1/3/7 gün); anahtar biçimi `^(decl\|teb\|rapor\|berat\|bordro\|bordro-eksik\|lisans):…` |
| İş kutusu öğesi (`InboxItem`) | kararlı anahtar, ör. `decl:<firma>:KDV1:2026-09` | **Saklanmaz**, her istekte kaynaktan türetilir → "kapandı mı" durumu ayrıca tutulmadığı için tutarsızlık birikmez |

## İş kuralları (domain)

`domain/inbox-items.ts`: `severityForDue` (`late | soon | normal`), `daysUntil`, `sortInbox` (önem, sonra tarih), `countInbox`. Kişi alanları gösterilirken `maskTckn` (shared-kernel).

## Kullanım senaryoları

`InboxService.list` — kaynaklar: verilmemiş beyannameler (tax-filing `control`), incelenmemiş tebligatlar (tebligat `list`), bekleyen e-raporlar, e-Defter beratları, bordro mutabakatı (payroll), lisans süresi; ertelemeler eklenir, süzme istemcide. Dashboard ve raporlar controller'da sorgu birleştirir. CSV (`infrastructure/csv.ts`): UTF-8 BOM, `;` ayraç, **formül enjeksiyonu koruması** (`= + - @` ile başlayan metin), her indirme denetim kaydı (`report.export`).

## HTTP uçları

`GET /api/inbox` · `POST /api/inbox/snooze`, `/unsnooze` · `GET /api/dashboard/summary` · `GET /api/reports/:tur` (`firmalar`, `beyanname`, `edefter`, `tebligat`, `sgk-rapor`, `ise-giris-cikis`)

## Bağımlılıklar

Facade'lar: tax-filing, tebligat, payroll, notifications, social-security. Doğrudan okuma (geçiş istisnası): `sgkReport`, `employmentEvent`, `sgkWorkplace`, `subscription`, `eTebligat`, `taxCalendarEvent` — [taktik borç](../03-taktiksel-tasarim/06-taktik-borc.md).

## Testler

`domain/inbox-items.spec.ts`, `infrastructure/csv.spec.ts` · e2e `test/notifications-workspace.e2e-spec.ts` (iş kutusu maskeli, erteleme büro genelinde, özet bölümleri, 6 CSV raporu: BOM/ayraç/enjeksiyon/denetim) · arayüz `apps/web/e2e` (iş kutusu 4 ekranda).

## Bilinen sınırlar

Büyük bürolarda iş kutusu her istekte birkaç sorgu çalıştırır; gerekirse önbellekli okuma modeline (olaylarla güncellenen tablo) evrilebilir — sınır ve anahtarlar buna hazır.
