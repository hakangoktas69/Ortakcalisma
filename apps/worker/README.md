# apps/worker

Arka plan işçisi ve tek seferlik görevler. Bağlam ve kurallar: [CLAUDE.md](CLAUDE.md).

| Komut | İş |
|---|---|
| `src/main.ts` | outbox → RabbitMQ taşıyıcı, `entegrasyon.sonuc` uygulayıcı (`src/uygulayici.ts`), takılı iş temizliği |
| `src/migrate.ts` | kontrol düzlemi + shard migration'ları, rol parolaları |
| `src/hesap-ac.ts` | ofis / üye / demo hesabı açma |

Sonuç uygulayıcı bileşim köküdür: bağlamları (sync, credentials, portfolio, tax-filing) yalnız public API'leriyle birleştirir; Python ACL'in sonucunu şemayla doğrulamadan uygulamaz. Akış: [baglamlar/sync.md](../../docs/baglamlar/sync.md).
