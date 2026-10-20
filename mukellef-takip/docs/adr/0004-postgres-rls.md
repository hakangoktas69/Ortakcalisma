# 0004 — PostgreSQL Row Level Security ile tenant izolasyonu

- **Durum:** Kabul (2026-10-20), uygulama Faz 2
- **Bağlam:** İzolasyon yalnız uygulama sorgularındaki `tenantId` filtresine dayanıyor (~320 kullanım). Tek bir unutulmuş filtre büro arası veri sızıntısıdır; KVKK açısından en ağır risk.
- **Karar:** Tenant'lı tüm tablolarda `tenantId` kolonu (alt tablolarda denormalize), RLS politikaları, uygulama `app_user` rolüyle (tablo sahibi değil) bağlanır, istek başına transaction içinde `set_config('app.tenant_id')`. Migration ayrı `migrator` rolüyle. Uygulama filtresi de korunur.
- **Sonuç:** Prisma'da tenant bağlamı için client extension gerekir; sistem işleri tenant döngüsüyle bağlam kurar. İzolasyon e2e testleri RLS'ten önce yazılır.

## Uygulama notu (2026-10-20)
- Denormalize `tenantId` yerine alt tablolarda üst tablo üzerinden `EXISTS` politikası kullanıldı (uygulama kodu değişmedi). Performans gerekirse denormalizasyona geçilebilir.
- Bağlam, Prisma'nın `pg` havuzunda bağlantı alınırken AsyncLocalStorage'dan okunup oturum ayarı olarak yazılır (`rls-pool.ts`); her sorguyu transaction'a sarmaktan daha az maliyetlidir.
