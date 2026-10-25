# apps/worker — arka plan işçisi (Node)

Durum: çalışıyor: outbox taşıyıcı (→ RabbitMQ), entegrasyon sonucu uygulayıcı (`src/uygulayici.ts`), takılı iş temizliği, belge saklama temizliği, migration çalıştırıcı, `hesap-ac` komutu. Gece planlayıcı ve bölüm/arşiv bakımı yok ([06 §3](../../docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#3-depo-yapısı)).

- İşçi bir **bileşim köküdür**: bağlamları yalnız public API'leriyle (`@eworks/<ctx>`) birleştirir, her iş ilgili bağlamın **application** katmanını çağırır; alan kuralı burada yazılmaz ([DDD rehberi §4.3](../../docs/gelistirici-rehberi/ddd.md#43-bileşim-kökü)).
- Python ACL (`services/integration`) ham kurum verisini `contracts/` diline çevirir; işçi sonucu **şemayla doğrular** (Ajv) ve uyuşmazlıkta uygulamaz (fail-closed), sonra bağlam use-case'lerine dağıtır.
- Kuruma giden her istek merkezi hız sınırlayıcıdan geçer (Redis GCRA); zamanlanmış iş kuruma **yazma** yapmaz.
- İş başlarken `requested_by` için kurum hesabı kullanım hakkı yeniden doğrulanır (05 §3.4).
- Testler: `test/*.test.ts` (in-memory portlarla birim), yığın davranışı bağlamların `*.int.test.ts`'lerinde.
