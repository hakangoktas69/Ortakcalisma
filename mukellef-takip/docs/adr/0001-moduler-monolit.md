# 0001 — Modüler monolit

- **Durum:** Kabul (2026-10-20)
- **Bağlam:** ~9.5k satır NestJS, tek küçük ekip, tek PostgreSQL. Modüller teknik klasör; context'ler arası doğrudan çağrı ve tablo erişimi var. Ölçek ihtiyacı ağırlıkla arka plan işlerinde (SGK senkronu, bildirim).
- **Karar:** Tek kod tabanı, tek veritabanı; içinde DDD bounded context'ler (`apps/api/src/modules/*`) ve sıkı sınırlar (public `index.ts`, domain event, dependency-cruiser). HTTP (`api`) ve iş (`worker`) ayrı container olarak aynı imajdan çalışır.
- **Sonuç:** Mikroservis operasyon yükü (dağıtık transaction, servis keşfi, çoklu DB) yok; worker yatay ölçeklenebilir; bir context gerekirse sınırı hazır olduğundan ayrı servise çıkarılabilir.
- **Reddedilen:** Mikroservisler — bugünkü ölçek ve ekip için erken.
