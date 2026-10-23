// PUBLIC API — tax-filing bağlamı: e-Beyanname sözleşmeleri, beyannameler, tahakkuklar, son gün kuralları.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/tax-filing.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'tax-filing' as const;
