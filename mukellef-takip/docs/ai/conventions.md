# Kodlama kuralları

## Dil
- UI metni, kod yorumu, commit mesajı, doküman: **Türkçe**. Tanımlayıcılar İngilizce (sözlük: `bounded-contexts.md`).
- Yorumlar "neden"i anlatır; mevcut yoğunluğa uy (kısa, tek satır, iş kuralı veya yasal dayanak: "VUK 107/A").

## Backend
- ESM: import yollarında `.js` uzantısı zorunlu (`from './x.js'`).
- Yeni özellik = önce hangi context'e ait olduğuna karar ver (`bounded-contexts.md`). Yeni context gerekiyorsa ADR yaz.
- İş kuralı → `domain/` altında saf fonksiyon + `*.spec.ts`. Controller'da iş kuralı yok.
- Başka context'in verisi → onun `index.ts` query facade'ı; yan etki → domain event (outbox).
- Her tenant'lı sorgu `tenantId` içerir (RLS olsa bile).
- DTO'lar class-validator ile; `whitelist` açık — DTO'da olmayan alan reddedilir.
- Hata mesajları kullanıcıya Türkçe ve kişisel veri içermez.
- Ortam değişkenleri `platform/config/config.ts` şemasında tanımlanır ve açılışta doğrulanır; okunması yalnız `platform/` ve context'lerin `infrastructure/` / modül fabrikalarında (yeni değişken = şemaya ekle + `.env.example` + `infra/docker`).
- Dış servis = port (application) + gerçek istemci + `mock` istemci (infrastructure); `*_MODE` env ile seçilir (`off|mock|live`).

## Test
Ayrıntılı strateji, eşikler ve kapılar: `testing.md`.
- Birim: `domain` kuralları ve parser'lar için zorunlu. Vitest, dosya yanında `*.spec.ts`.
- e2e: `apps/api/test/*.e2e-spec.ts`; tenant izolasyonu, auth, aktarım, ödeme callback.
- Gerçek kişisel veri test fixture'ına girmez (`test-tckn.ts` gibi geçerli ama sahte üretici kullan).
- Değişiklik sonrası: `npm run verify` (izole Docker yığınında her şey); arayüz değiştiyse ayrıca `npm run test:ui`.

## Veritabanı / migration
- `apps/api` içinde `npx prisma migrate dev --name <kisa_ad>`; migration dosyası elle düzenlenebilir (RLS, REVOKE, backfill SQL).
- Kırıcı şema değişikliği iki adım: (1) yeni kolon + backfill + kod ikisini okur; (2) eski kolonu bırak.
- Seed yalnız demo verisi; prod'da çalışmaz.

## Web
- `apps/web/AGENTS.md`: Next.js sürümü farklı, `node_modules/next/dist/docs/` oku.
- Yeni özellik: `content/faq.ts` (SSS) ve `content/changelog.ts` (Yenilikler, dizinin başına) güncellenir.
- Token/kişisel veri tarayıcı depolamasına yazılmaz.

## Commit
- Türkçe, kısa başlık (emir kipi değil, ne yapıldığı): "Bordro aktarımında e-Bildirge mutabakatı ekle".
- Sır, `.env`, `generated/`, `node_modules`, kişisel veri içeren dosya commit edilmez (gitleaks CI'da).
