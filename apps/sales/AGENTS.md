<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->
# apps/sales — satış portalı (Next.js, ayrı imaj, turuncu tema) — kodlama ajanı talimatları

Bu dizinde çalışırken önce bu dizindeki `CLAUDE.md`'yi oku; kurallar oradadır ve senin için de bağlayıcıdır. Kök talimatlar: [../../AGENTS.md](../../AGENTS.md).

`CLAUDE.md` içeriği:

- Ofis, müşavir ve mükellef hesapları **yalnız buradan** açılır; kendi kendine kayıt kapalı (`DISABLE_SIGNUP=true`). Ofis açılırken kiracı shard'ı atanır (5.7).
- `SalesUser` ayrı tablodadır, iki adımlı doğrulama zorunludur.
- Mükellef onayı satış sözleşmesiyle: `credential_consents` kaydı `given_by = sales_contract` + belge kimliği.
- **Mükellef iş verisini (beyanname, SGK, belge) göremez**; veritabanı rolüyle zorlanır (`sales_user`). Ofisi etkileyen her işlem iki denetim kaydına yazılır (satış + ofis).
- Bağlam: `packages/contexts/sales` (yalnız `index.ts` üzerinden). Sayfa ve uçlar portal gibi tek yetki anahtarı bildirir.
