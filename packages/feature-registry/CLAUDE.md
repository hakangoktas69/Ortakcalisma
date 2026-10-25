# packages/feature-registry — özellik ağacı = yetki ağacı = TDD durum kaynağı

Ayrıntı: [TDD rehberi §1, §4.2, §6.2](../../docs/gelistirici-rehberi/tdd.md), [06 §8](../../docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#8-özellik-durumu-ve-ön-yüzde-kırmızıyeşil-işaretleme-d22).

- Yeni özellik **önce buraya** girer: `src/features.ts`'te `mod(…)`, `page(…)`, `actions(…)` yardımcılarıyla; anahtar noktalı, küçük harf (`gorevler.assign`). Yeni anahtar kırmızı başlar.
- Durum **elle değiştirilmez**: `feature-status.json` ve `docs/ozellik-durumu.md` `pnpm features` ile test sonuçlarından üretilir. Yeşil için anahtara bağlı kabul testi (`apps/web/e2e`, `@F:<anahtar>`) gerekir.
- Kurumla konuşan işlem `LIVE_ACTIONS`'a girer (`live: true`, D33). `canli-dogrulamalar.json`'a kayıt yalnız gerçekten yapılmış canlı koşudan sonra ve kullanıcı talimatıyla eklenir; ajan kayıt uydurmaz. Kayıtta kişisel veri yok, yalnız sayılar.
- Anahtar yeniden adlandırma/silme: yetki şablonlarını, `sayfaIzni`/`apiIzni` çağrılarını ve `@F:` etiketlerini aynı değişiklikte güncelle; `apps/web/src/bff/yetki-anahtarlari.test.ts` kayıtta olmayan anahtarı yakalar.
- Bağlam atanmamış modül `context: null` ile kalır; atamak bir karardır (D-NN/K-NN).
