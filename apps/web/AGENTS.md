<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->
# apps/web — müşavir ve mükellef portalı (Next.js: sunum + BFF) — kodlama ajanı talimatları

Bu dizinde çalışırken önce bu dizindeki `CLAUDE.md`'yi oku; kurallar oradadır ve senin için de bağlayıcıdır. Kök talimatlar: [../../AGENTS.md](../../AGENTS.md).

`CLAUDE.md` içeriği:

- `src/app/` yalnız rota (ince). Sayfa `sayfaIzni('<anahtar>')`, BFF ucu `apiIzni(req, '<anahtar>', degisiklik)` ile başlar (`src/bff/oturum.ts`); anahtar `packages/feature-registry`'de olmalı. `src/bff/yetki-anahtarlari.test.ts` bunu denetler; herkese açık rota yalnız gerekçesiyle oradaki listeye girer.
- BFF ucu sırası: koruma → gövdeyi sınırlı oku ve doğrula (`jsonGovde`, bozuksa 400) → use-case (`konteyner()` bağımlılıkları) → `Result`'ı HTTP'ye eşle (sabit Türkçe metin tablosu, ör. `src/bff/gorevler.ts`). İş kuralı burada değil, use-case'tedir; `String(error)` arayüze verilmez.
- Bağlam paketlerine yalnız `@eworks/<ctx>` (index) ile erişilir. `src/features/<ctx>` başka bağlamın `features`'ını, platformu, altyapıyı import etmez (ortak bileşen `src/shared/ui`).
- Tamamlanmamış özellik `<FeatureGate>`/`<FeatureBadge>` ile **kırmızı** görünür, her ortamda herkese (D30); uygulanmamış işlem sunucuda `501`. Henüz rotası olmayan sayfalar `(panel)/[...yol]` yer tutucusundan gelir.
- Tarayıcı JS'inde token, kurum adresi, anahtar yok (D5); `NEXT_PUBLIC_*` yasak. Oturum Redis'te, HttpOnly çerez, değişiklikte CSRF.
- Kabul testleri `e2e/*.e2e.ts` (Playwright, dört ekran: 375/768/1366/1920), adında `@F:<anahtar>`; her test kendi ofisini açar (`ofisAc`), erişilebilir seçici kullanır, `tasmaYok` ve `hataTopla` ile biter. Koşucu: `node tools/deploy/yigin.mjs e2e`.
- Server action henüz yok; ilki yazılırken koruma yardımcısı ve yetki anahtarı testi birlikte genişletilir.
