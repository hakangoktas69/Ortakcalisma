// PUBLIC API — credentials bağlamı: Kurum hesabı, Vault, kullanım izni, mükellef onayı, kilitlenme koruması.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/credentials.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'credentials' as const;
