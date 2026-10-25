# packages/kernel — paylaşılan çekirdek (shared kernel)

Tüm bağlamların aynı kuralla kullandığı saf değer nesneleri ve ortak tipler: `TaxId` (VKN/TCKN), `Period`, `Result`, `Clock`, `DomainEvent`, `toCsv`. Ayrıntı: [DDD rehberi §2.5, §3.2](../../docs/gelistirici-rehberi/ddd.md).

- **Hiçbir pakete bağımlı değildir** (`pnpm arch`: `kernel-saf-kalir`); G/Ç, saat, rastgele yok.
- Buraya eklemek tüm bağlamları etkileyen ortak bir karardır: yalnız birden çok bağlamda gereken, kararlı ve saf kavramlar. Tek bağlamın kavramı o bağlamın `domain`'ine gider. Emin değilsen sor.
- Değer nesnesi salt okunurdur ve ayrıştırıcısı `Result` döner (`parseTaxId`, `parsePeriod`); geçersiz değer oluşmaz.
- Var olan dışa aktarımı değiştirmek/kaldırmak tüm tüketicileri kırar: önce kullanımları bul, aynı değişiklikte güncelle.
- Kapsam eşiği burada da geçerlidir (%90 satır / %80 dal); her yeni fonksiyon önce kırmızı testle (`test/kernel.test.ts`).
- Ekranda VKN/TCKN yalnız `maskTaxId` ile gösterilir; testte gerçek kimlik yok (`@eworks/testing`).
