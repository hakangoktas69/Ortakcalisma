// PUBLIC API — portfolio bağlamı: Mükellef kartı, müşavir bağı (tek müşavir), mükellef kullanıcıları, devir.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/portfolio.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'portfolio' as const;
