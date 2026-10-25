# apps/sales — satış portalı (Next.js, ayrı imaj, turuncu tema)

Durum: **ekran yok**; hesap açma use-case'i `packages/contexts/sales`'te ve `apps/worker`'daki `hesap-ac` komutunda çalışıyor, `satis.*` özellikleri kırmızı. Kararlar: D27, [08 §2](../../docs/hedef-mimari/08-depo-yeniden-yapilanmasi.md#2-satış-portalı-d27); desen `eski/mukellef-takip/satis` (ADR 0009). Geliştirmeye başlamadan `gelistir` becerisi.

- Ofis, müşavir ve mükellef hesapları **yalnız buradan** açılır; kendi kendine kayıt kapalı (`DISABLE_SIGNUP=true`). Ofis açılırken kiracı shard'ı atanır (5.7).
- `SalesUser` ayrı tablodadır, iki adımlı doğrulama zorunludur.
- Mükellef onayı satış sözleşmesiyle: `credential_consents` kaydı `given_by = sales_contract` + belge kimliği.
- **Mükellef iş verisini (beyanname, SGK, belge) göremez**; veritabanı rolüyle zorlanır (`sales_user`). Ofisi etkileyen her işlem iki denetim kaydına yazılır (satış + ofis).
- Bağlam: `packages/contexts/sales` (yalnız `index.ts` üzerinden). Sayfa ve uçlar portal gibi tek yetki anahtarı bildirir.
