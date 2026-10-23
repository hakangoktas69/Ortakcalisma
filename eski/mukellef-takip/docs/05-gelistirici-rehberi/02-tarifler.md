# 5.2 Tarifler

> Önce: [Katmanlar](../03-taktiksel-tasarim/01-katmanlar.md), [Yapı taşları](../03-taktiksel-tasarim/02-yapi-taslari.md) · Her tarif `npm run verify` yeşil ile biter.

İçerik: [A. Uç eklemek](#a-mevcut-bağlama-uç-eklemek) · [B. İş kuralı eklemek](#b-iş-kuralı-eklemek) · [C. Olay yayınlamak ve dinlemek](#c-olay-yayınlamak-ve-dinlemek) · [D. Başka bağlamdan veri okumak](#d-başka-bağlamdan-veri-okumak) · [E. Tablo / kolon eklemek](#e-tablo-veya-kolon-eklemek) · [F. Kişisel veri alanı eklemek](#f-kişisel-veri-alanı-eklemek) · [G. Dış servis entegrasyonu](#g-dış-servis-entegrasyonu) · [H. Zamanlanmış iş](#h-zamanlanmış-iş) · [I. Yeni bounded context](#i-yeni-bounded-context) · [J. Web sayfası](#j-web-sayfası)

---

## A. Mevcut bağlama uç eklemek

1. **DTO** — `interface/http/` içinde class-validator ile. Global `ValidationPipe` `whitelist + forbidNonWhitelisted` çalışır: tanımlanmamış alan 400 döner.
   ```ts
   // modules/workspace/interface/http/inbox.controller.ts
   class SnoozeDto {
     @Matches(KEY, { message: 'Geçersiz iş anahtarı' }) @MaxLength(220) key: string;
     /** 1 = yarına, 7 = gelecek haftaya */
     @IsIn([1, 3, 7]) days: number;
   }
   ```
2. **Servis metodu** — `application/` içinde; Prisma burada. Büroyu parametre olarak al (`tenantId`), yine de filtrele (RLS ikinci hattır).
3. **Controller** — ince: guard, DTO, `@CurrentUser()`, servis çağrısı.
   ```ts
   @Controller('inbox')
   @UseGuards(AuthGuard)
   export class InboxController {
     @Post('snooze')
     snooze(@CurrentUser() user: AuthUser, @Body() dto: SnoozeDto) {
       const until = new Date();
       until.setHours(8, 0, 0, 0);
       until.setDate(until.getDate() + dto.days);
       return this.inbox.snooze(user.tenantId, user.sub, dto.key, until);
     }
   }
   ```
   Yönetici işi → `@UseGuards(AdminGuard)`; pahalı/hassas → `@Throttle(RATE_LIMITS.heavy)`; kişisel veri okuyor/değiştiriyorsa `audit.log(...)`.
4. **E2E testi** — bağlamın `test/*.e2e-spec.ts` dosyasına: mutlu yol, doğrulama (400), yetki (STAFF → 403), **başka büro (404)**. Yanıtta TCKN varsa `expectNoFullTckn(body)`.
5. Web'den kullanılıyorsa `apps/web/src/lib/api.ts` tipini güncelle; uç tablosu `README.md`'de.

## B. İş kuralı eklemek

1. Saf fonksiyon olarak `domain/` içine; tarih gerekiyorsa `now = new Date()` parametresi.
2. Yanına `*.spec.ts`: sınır durumları, hafta sonu/tatil, geçersiz girdi. Birim testi kapsam eşikleri domain için yüksektir (fonksiyon %95).
3. Servis bu fonksiyonu çağırır; kuralı controller'da veya Prisma sorgusunda **yeniden yazma**.
4. Kural kullanıcıya görünür bir davranışı değiştiriyorsa: bağlam sayfası "İş kuralları", `changelog.ts`, gerekirse `faq.ts`.

## C. Olay yayınlamak ve dinlemek

**Yayıncı bağlamda:**
```ts
// domain/events.ts
export const INVOICE_IMPORTED = 'invoicing.invoices.imported';
export interface InvoicesImported { [k: string]: string | number; companyId: string; companyTitle: string; count: number }
// index.ts
export { INVOICE_IMPORTED, type InvoicesImported } from './domain/events.js';
// application — verinin yazıldığı transaction içinde:
await this.prisma.$transaction(async (tx) => {
  await tx.invoice.createMany({ data: rows });
  await this.outbox.publish({ type: INVOICE_IMPORTED, tenantId, payload }, tx);
});
```

**Dinleyen bağlamda** (`application/event-handlers.ts`, modülün `providers`'ına eklenir ve worker'da yüklenmelidir):
```ts
@OnDomainEvent(INVOICE_IMPORTED)
async invoicesImported(e: DomainEvent) {
  const p = e.payload as unknown as InvoicesImported;
  // idempotent: aynı olay iki kez gelebilir → dedupeKey / upsert
}
```
**Test:** `test/worker.e2e-spec.ts` kalıbı — outbox satırı oluştur, `dispatchBatch()` çağır, sonucu ve ikinci teslimde tekrar etmediğini doğrula. Kurallar: [3.3](../03-taktiksel-tasarim/03-olaylar-ve-outbox.md).

## D. Başka bağlamdan veri okumak

1. Sahip bağlamın servisine **sorgu metodu** ekle (yalnız gereken alanlar, maskeli kişi verisi).
2. Sahibin `index.ts`'inden dışa aç; sahibin modülü `exports` listesine ekle.
3. Tüketen modül sahibin modülünü `imports`'a alır, servisi enjekte eder.
4. Başka bağlamın tablosunu `this.prisma.<model>` ile **okuma** — bu, [taktik borç §3](../03-taktiksel-tasarim/06-taktik-borc.md) listesini büyütür.

## E. Tablo veya kolon eklemek

1. `apps/api/prisma/schema/<sahip-context>.prisma`'da modeli değiştir.
2. `cd apps/api && npx prisma migrate dev --name <kisa_ad>` → oluşan SQL'i incele.
3. Büroya ait yeni tablo ise aynı migration'a ekle:
   ```sql
   ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "X" FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON "X"
     USING (app_bypass() OR "tenantId" = app_tenant())
     WITH CHECK (app_bypass() OR "tenantId" = app_tenant());
   ```
   (Firma üzerinden bağlıysa `EXISTS (SELECT 1 FROM "Company" c WHERE c.id = "companyId" AND c."tenantId" = app_tenant())`.)
4. `security.e2e-spec.ts`'e çapraz büro testi ekle (B bürosu A'nın satırını göremez).
5. Kolon kaldırma iki sürümde ([Veri modeli](../04-mimari/02-veri-modeli.md#migration-kuralları)).

## F. Kişisel veri alanı eklemek

1. Önce sor: **gerçekten gerekli mi?** (KVKK veri minimizasyonu). Gerekirse sınıfını [security-kvkk.md](../ai/security-kvkk.md)'ye göre belirle.
2. Şifreli kolon (`xxxEnc`), arama gerekiyorsa `xxxHash` (`vault.blindIndex('xxx', value)`); düz kolon yok.
3. Yazma `vault.encrypt` / `PersonalDataService.seal`, okuma `open`/`decrypt`; ekranda maskeli.
4. Log, hata mesajı, olay yükü, `externalBody`, denetim `detail` alanlarına **koyma**.
5. Saklama süresini belgeye yaz (imha işi gelince kullanılacak).

## G. Dış servis entegrasyonu

1. Port arayüzü `application/ports/<servis>.types.ts`.
2. `infrastructure/` içinde `mock` ve `live` uygulamaları; mod `config.ts` şemasında (`<SERVIS>_MODE: z.enum(['off','mock','live'])`), üretimde eksik ayar → açılmaz.
3. Anahtar/şifre Docker secret (`*_FILE`), kurum şifresi ise KMS ile kolon.
4. Test: sahte HTTP/SOAP sunucusuna karşı (`soap-vizite.client.spec.ts`, `iyzico.e2e-spec.ts` kalıbı) — imza, hata kodları, zaman aşımı.
5. Yurt dışına veri gidiyorsa: KVKK md.9 onayı ve [güvenlik mimarisi](../04-mimari/03-guvenlik-mimarisi.md#dışa-veri-akışları-ve-kurallar) tablosu.

## H. Zamanlanmış iş

1. Bağlamın `*WorkerModule`'ünde bir BullMQ işleyicisi; `onModuleInit` içinde `queue.upsertJobScheduler('<ad>', { pattern: '0 3 * * *', tz: 'Europe/Istanbul' }, …)`.
2. İş tüm bürolarda çalışacaksa: büro listesini `runAsSystem` ile al, her büro için `runAsTenant(id, …)`; bir büronun hatası diğerlerini durdurmasın.
3. Yalnız `WorkerModule` import eder (HTTP sürecine eklenmez).
4. Test: `test/worker.e2e-spec.ts`.

## I. Yeni bounded context

Önce bunun gerçekten yeni bir bağlam olduğuna karar ver ([iş alanı](../01-stratejik-tasarim/01-is-alani-ve-alt-alanlar.md)): kendi dili, kendi kuralları ve kendi verisi var mı? Varsa:

1. ADR yaz (`docs/adr/00NN-<ad>.md`) — neden ayrı, ilişki kalıbı.
2. İskelet: `modules/<ad>/{domain,application,infrastructure,interface/http}/`, `<ad>.module.ts`, `index.ts`.
3. Şema: `prisma/schema/<ad>.prisma` + RLS'li migration.
4. `app.module.ts`'e (ve gerekiyorsa `worker.module.ts`'e) modülü ekle.
5. Belgeler: [katalog](../02-baglamlar/README.md)'a sayfa (şablonla), [bağlam haritası](../01-stratejik-tasarim/03-baglam-haritasi.md), [ortak dil](../01-stratejik-tasarim/02-ortak-dil.md), `docs/ai/bounded-contexts.md`.
6. Testler: domain birim + `test/<ad>.e2e-spec.ts` (çapraz büro dahil).

## J. Web sayfası

1. `apps/web/src/app/(panel)/<yol>/page.tsx` → `components/<Ad>View.tsx` (istemci bileşeni).
2. Yerleşim kuralları (4 ekran boyutu): ızgaralar `grid grid-cols-1 lg:grid-cols-[…]`, esnek sütunlarda `minmax(0,1fr)`; tablolar `<div className="table-scroll">` içinde.
3. `apps/web/e2e/support.ts` `PANEL_ROUTES`'a ekle → taşma, konsol hatası ve kırpılma her ekran boyutunda otomatik test edilir.
4. Metinler Türkçe; `changelog.ts` girdisi. Ayrıntı: [apps/web/CLAUDE.md](../../apps/web/CLAUDE.md).
