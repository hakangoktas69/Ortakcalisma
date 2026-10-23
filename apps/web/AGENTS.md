<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->
# apps/web — müşavir ve mükellef portalı (Next.js: sunum + BFF) — kodlama ajanı talimatları

Bu dizinde çalışırken önce bu dizindeki `CLAUDE.md`'yi oku; kurallar oradadır ve senin için de bağlayıcıdır. Kök talimatlar: [../../AGENTS.md](../../AGENTS.md).

`CLAUDE.md` içeriği:

- `src/app/` yalnız rota (ince); ekran `src/features/<context>/screens`, işlem `features/<context>/actions.ts` (server action → `packages/contexts/<context>` application).
- `src/app/api/<context>/` BFF uçları: doğrula → oturum + CSRF + **yetki anahtarı** + firma kapsamı → use-case → yanıt. İş kuralı burada değil, use-case'tedir.
- Her sayfa, uç ve server action `packages/feature-registry`'deki **tek bir yetki anahtarı** bildirir; anahtarsız sayfa/uç CI'da reddedilir (05 §3.4).
- Tamamlanmamış özellik `<FeatureGate>`/`<FeatureBadge>` ile **kırmızı** görünür, her ortamda herkese (D30); uygulanmamış işlem sunucuda `501` döner.
- Tarayıcı JS'inde token, kurum adresi, anahtar yok (D5); `NEXT_PUBLIC_*` yasak. Oturum Redis'te, HttpOnly çerez.
- `features/<ctx>` başka bir bağlamın `features` klasörünü kullanmaz (ortak bileşen `src/shared/ui`); platform/altyapı import etmez (`pnpm arch`).
- Arayüz testleri dört ekranda: telefon 375, tablet 768, laptop 1366, büyük 1920. Kabul testleri `@F:<anahtar>` etiketlidir.
