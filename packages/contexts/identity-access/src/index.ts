// PUBLIC API — identity-access bağlamı: Kullanıcı, oturum, MFA, yetki ağacı, rol şablonları, kişiye özel izin, personel ataması.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/identity-access.md
// Katmanlar: domain (saf kural, aggregate, olay, repository portu) ← application (use-case) ← infrastructure (Postgres, outbox).
export const CONTEXT = 'identity-access' as const;
