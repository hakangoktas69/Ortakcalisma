<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->
# packages/contexts — bounded context'ler (alan + uygulama katmanı) — kodlama ajanı talimatları

Bu dizinde çalışırken önce bu dizindeki `CLAUDE.md`'yi oku; kurallar oradadır ve senin için de bağlayıcıdır. Kök talimatlar: [../../AGENTS.md](../../AGENTS.md).

`CLAUDE.md` içeriği:

- Her bağlam: `src/domain` (saf kural) ← `src/application` (use-case + port arayüzleri) ← `src/infrastructure` (Postgres adaptörleri); dışarıya yalnız `src/index.ts`, adıyla (`export *` yok). `pnpm arch` zorlar.
- **domain saf:** yalnız kendi domain'i ve `@eworks/kernel`; veritabanı, Redis, `@eworks/platform`, `process.env`, `Date.now()`, `Math.random()`, `randomUUID()` yok. Zaman parametre ya da `Clock` ile, kimlik `newId` bağımlılığıyla gelir.
- Taktiksel yapılar sınıf değil, salt okunur tip + saf fonksiyondur; sabit küme `as const` dizi (enum yok). Beklenen hata `Result` (`err('yetki_yok')`) ya da alan hata listesi; hata kodları Türkçe birleşim tipi.
- Use-case imzası: `(ctx: { sub, org }, girdi…, can, d: { portlar })`. Repository portu aggregate kökü başına, application'da tanımlanır; application infrastructure'ı import etmez.
- Başka bağlama yalnız onun `index.ts`'iyle ya da port (bileşim kökünde doldurulur) veya olayla erişilir. **Başka bağlamın tablosuna sorgu yok** (bugünkü `portfolio.firms` birleşimleri bilinen sapmadır, çoğaltılmaz).
- Adaptör: `ShardRouter.poolFor(org)` + `withUser(pool, { sub, org }, fn)`; yalnız kendi şeması; SQL'de de `org_id` filtresi; denetim kaydı (`audit.record`) ve outbox değişiklikle aynı işlemde.
- Testler: `test/domain` ve `test/application` birim (in-memory `Map` portlar, mock kütüphanesi yok); `test/infrastructure/*.int.test.ts` gerçek yığında. domain + application kapsamı %90 satır / %80 dal, `pnpm verify` zorlar; eşik düşürülmez.
- Kişisel veri (VKN/TCKN, ad, sağlık) log'a, hata mesajına, olay yüküne girmez; fikstürde `@eworks/testing` (`fakeVkn`, `fakeTckn`, `seededRandom`).
- Kural, uç, olay veya sınır değiştiyse `docs/baglamlar/<ctx>.md` aynı değişiklikte güncellenir.
