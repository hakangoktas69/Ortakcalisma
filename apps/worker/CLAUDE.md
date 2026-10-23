# apps/worker — arka plan işçisi (Node)

Durum: iskelet. Görevleri: outbox yayıncı, gece planlayıcı, entegrasyon sonucu uygulayıcı, belge temizliği, bölüm/arşiv bakımı ([06 §3](../../docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#3-depo-yapısı)).

- Her iş ilgili bağlamın **application** katmanını çağırır; alan kuralı burada yazılmaz.
- Python ACL (`services/integration`) ham kurum verisini `contracts/` diline çevirir; sonucu tablolara bu işçideki use-case uygular.
- Kuruma giden her istek merkezi hız sınırlayıcıdan geçer (Redis GCRA); zamanlanmış iş kuruma **yazma** yapmaz.
- İş başlarken `requested_by` için kurum hesabı kullanım hakkı yeniden doğrulanır (05 §3.4).
