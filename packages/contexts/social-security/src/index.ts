// PUBLIC API — social-security bağlamı: SGK işyeri, e-Bildirge, işe giriş/çıkış, e-Rapor, iş kazası, kontrol listesi.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/social-security.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'social-security' as const;
