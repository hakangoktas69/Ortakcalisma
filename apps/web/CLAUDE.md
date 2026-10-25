# apps/web — müşavir ve mükellef portalı (Next.js: sunum + BFF)

Durum: çalışıyor (Next.js 16, BFF, oturum, giriş, firmalar, kurum hesapları, beyanname, SGK, görev/not). Yapı ve kurallar: [06 §3–§4](../../docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md), uygulama: [DDD rehberi §4.4](../../docs/gelistirici-rehberi/ddd.md#44-bff-ve-ui--ince-kabuk). Kod değiştirmeden önce `gelistir` becerisi.

- `src/app/` yalnız rota (ince). Sayfa `sayfaIzni('<anahtar>')`, BFF ucu `apiIzni(req, '<anahtar>', degisiklik)` ile başlar (`src/bff/oturum.ts`); anahtar `packages/feature-registry`'de olmalı. `src/bff/yetki-anahtarlari.test.ts` bunu denetler; herkese açık rota yalnız gerekçesiyle oradaki listeye girer.
- BFF ucu sırası: koruma → gövdeyi sınırlı oku ve doğrula (`jsonGovde`, bozuksa 400) → use-case (`konteyner()` bağımlılıkları) → `Result`'ı HTTP'ye eşle (sabit Türkçe metin tablosu, ör. `src/bff/gorevler.ts`). İş kuralı burada değil, use-case'tedir; `String(error)` arayüze verilmez.
- Bağlam paketlerine yalnız `@eworks/<ctx>` (index) ile erişilir. `src/features/<ctx>` başka bağlamın `features`'ını, platformu, altyapıyı import etmez (ortak bileşen `src/shared/ui`).
- Tamamlanmamış özellik `<FeatureGate>`/`<FeatureBadge>` ile **kırmızı** görünür, her ortamda herkese (D30); uygulanmamış işlem sunucuda `501`. Henüz rotası olmayan sayfalar `(panel)/[...yol]` yer tutucusundan gelir.
- Tarayıcı JS'inde token, kurum adresi, anahtar yok (D5); `NEXT_PUBLIC_*` yasak. Oturum Redis'te, HttpOnly çerez, değişiklikte CSRF.
- Kabul testleri `e2e/*.e2e.ts` (Playwright, dört ekran: 375/768/1366/1920), adında `@F:<anahtar>`; her test kendi ofisini açar (`ofisAc`), erişilebilir seçici kullanır, `tasmaYok` ve `hataTopla` ile biter. Koşucu: `node tools/deploy/yigin.mjs e2e`.
- Server action henüz yok; ilki yazılırken koruma yardımcısı ve yetki anahtarı testi birlikte genişletilir.
