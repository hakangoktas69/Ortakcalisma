// PUBLIC API — sales bağlamı: Satış portalı: satış kullanıcıları, ofis/müşavir/mükellef hesabı açma, sözleşme ve mükellef onayı, dondurma, shard ataması; mükellef iş verisini görmez.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/sales.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'sales' as const;
