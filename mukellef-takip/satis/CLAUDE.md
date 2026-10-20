# Satış modülü (satis/)

Genel kurallar: `../CLAUDE.md`. Karar: `../docs/adr/0009-satis-modulu.md`. Kullanım ve uçlar: `README.md`.

## Sınırlar (pazarlıksız)
- Satış **mükellef verisi görmez**. Yeni bir ihtiyaç için `Company` dışındaki iş tablolarına yetki eklenmez; gerekiyorsa önce ekipte konuşulur. `Company`'de yalnız `id`, `tenantId`, `isActive` okunur.
- Satış kullanıcıları (`SalesUser`) ile büro kullanıcıları (`User`) karışmaz. Satış oturumu yalnız `satis/api`'de geçerlidir.
- Yeni tablo ya da yetki: `apps/api/prisma/schema/sales.prisma` + yeni migration; yetki `sales_grant_access()` desenini izler, `app_user`'dan `REVOKE` edilir, `test/security.e2e-spec.ts`'e eklenir.
- Büroyu etkileyen her işlem `SalesAuditService.logOffice` ile (satış zinciri + büronun AuditLog'u) tek transaction içinde yazılır. Detayda kişisel verinin kendisi değil, alan adı / kimlik / sayı yazılır.
- Geçici şifre ve kurtarma kodları yalnız oluşturuldukları yanıtta döner, hiçbir yerde saklanmaz (yalnız özetleri).
- Veri değiştiren uç CSRF başlığı (`X-Satis: 1`) ister; CORS açılmaz. Oturum çerezdedir, `localStorage`'a anahtar yazılmaz.

## Kod
- `satis/api/src/core.ts` — `apps/api`'den alınan **tek** geçiş noktası (şifre özeti, TOTP, denetim zinciri, şifreleme, Prisma). `core-rules.ts` yalnız saf kurallar (domain bunu kullanır).
- `domain/` saf kurallar + birim testleri (kapsam eşikli); `application/` servisler; `infrastructure/` Prisma, denetim; `interface/http/` controller, oturum, CSRF.
- Web: `src/lib/api.ts` istemci; sayfalar `src/app/(portal)/`. Duyarlı arayüz kuralları `apps/web/CLAUDE.md` ile aynı (375 → 1920).
- Renk: turuncu (`brand` = orange). Müşavir portalı mavi, sistem yönetimi koyu gri.

## Doğrulama
`npm run lint`, `typecheck`, `test`, `test:e2e` kökten satış dahil çalışır. Yeni uç → `test/*.e2e-spec.ts`; yetki sınırı → `test/security.e2e-spec.ts`.
