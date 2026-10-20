# 0003 — Domain event + transactional outbox

- **Durum:** Kabul (2026-10-20)
- **Bağlam:** `sgk`, `tebligat`, `billing` doğrudan `NotificationsService` çağırıyor; bildirim hatası ana işlemi etkileyebiliyor, bağımlılık yönü ters.
- **Karar:** Komut kendi verisiyle aynı transaction'da `OutboxEvent` yazar; worker'daki dağıtıcı olayları abonelere iletir (en az bir kez; abone idempotent). Taşıma: Postgres tablosu + worker taraması (ek altyapı yok); yük artarsa BullMQ'ya aktarılır.
- **Reddedilen:** Bellek içi event emitter (süreç çökerse olay kaybolur); harici broker (NATS/RabbitMQ) — şimdilik gereksiz.
