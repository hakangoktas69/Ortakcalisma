# apps/sales — satış portalı (Next.js, ayrı imaj, turuncu tema)

Durum: **çekirdek aşama çalışıyor (D40, 2026-10-26)**: satışçı girişi (zorunlu TOTP), ofis listesi, yeni ofis (+ yönetici müşavir + deneme lisansı). Dondurma, lisans uzatma, satış ekibi, mükellef sözleşmesi sonraki aşama. Kararlar: D27, D40, [08 §2](../../docs/hedef-mimari/08-depo-yeniden-yapilanmasi.md#2-satış-portalı-d27); bağlam sayfası [sales](../../docs/baglamlar/sales.md); desen `eski/hakan/mukellef-takip/satis` (ADR 0009). Geliştirmeye başlamadan `gelistir` becerisi.

- Ofis, müşavir ve mükellef hesapları **yalnız buradan** açılır; kendi kendine kayıt kapalı (`DISABLE_SIGNUP=true`). Ofis açılırken kiracı shard'ı atanır (5.7).
- `SalesUser` ayrı tablodadır (`sales.users`, GoTrue dışında), iki adımlı doğrulama zorunludur. Satış oturumu portalda, portal oturumu burada geçmez (ayrı çerez adları: `ew_satis_sid`, ara adım `ew_satis_adim`).
- Mükellef onayı satış sözleşmesiyle: `credential_consents` kaydı `given_by = sales_contract` + belge kimliği (sonraki aşama).
- **Mükellef iş verisini (beyanname, SGK, belge) göremez**; veritabanı rolüyle zorlanır (`eworks_sales`: shard'da yalnız `sales.*` hesap açma fonksiyonları). Ofisi etkileyen her işlem iki denetim kaydına yazılır (satış + ofis).
- Bağlam: `packages/contexts/sales` (yalnız `index.ts` üzerinden); bileşim kökü `src/bff/konteyner.ts`. Sayfa `satisSayfaIzni('<satis.*>')`, uç `satisApiIzni(req, '<satis.*>', degisiklik)` ile başlar (`src/bff/oturum.ts`); `src/bff/yetki-anahtarlari.test.ts` denetler, oturum öncesi giriş adımları gerekçesiyle oradaki açık listededir.
- Kalıp portal ile aynıdır: nonce'lu CSP (`src/proxy.ts`), HttpOnly + SameSite=Strict çerez, değişiklikte CSRF + aynı köken, gövde sınırlı okunur, `Result` → sabit Türkçe mesaj; beklenmeyen hata yalnız sınırda `hataGunlugu` ile (olay + hata sınıfı + SQLSTATE; kişisel veri yok). Satır içi `style` yok; renkler `src/app/globals.css` `:root`'ta.
- Form alanı `src/shared/ui/Alan.tsx`: ipucu ve hata `aria-describedby` ile bağlanır (erişilebilir ad yalnız etiket).
- Gizli bilgiler (kurtarma kodları, müşavirin geçici parolası) yalnız ilgili yanıtta bir kez döner (`Cache-Control: no-store`), URL'ye, loga, denetim kaydına girmez.
- Çalıştırma: yığında `http://localhost:8081` (`SATIS_PORT`); Docker'sız `pnpm --filter @eworks/sales-portal dev` → `http://127.0.0.1:8766` (ortam değişkenleri web ile aynı + `SALES_TOTP_KEY`, rol `eworks_sales`). İlk satışçı: `node tools/deploy/yigin.mjs satis-kullanici --eposta … --ad "…"`. Üretimde dışarı açılmaz (yalnız 127.0.0.1, SSH tüneli).
- Testler: `test/satis.int.test.ts` (gerçek roller, yığında), kabul `e2e/satis.e2e.ts` (dört ekran, `@F:` etiketli, `ekranDenetle` + `hataTopla`); `node tools/deploy/yigin.mjs test|e2e`.
