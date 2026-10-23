// PUBLIC API — workspace bağlamı: Görev, not, uyarı/okundu, kontrol listeleri (okuma modeli).
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/workspace.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'workspace' as const;
