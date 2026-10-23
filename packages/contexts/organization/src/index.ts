// PUBLIC API — organization bağlamı: Ofis, müşavir, üyelik, davet.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/organization.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'organization' as const;
