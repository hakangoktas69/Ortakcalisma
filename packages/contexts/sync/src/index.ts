// PUBLIC API — sync bağlamı: Entegrasyon kaydı, taşıma yolu, iş planlama, istek bütçesi, iş/adım durumu, sonuç dağıtımı.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/sync.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'sync' as const;
