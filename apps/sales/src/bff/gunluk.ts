import 'server-only';

// Operasyon logu (yalnız BFF sınırında beklenmeyen hata). Tek satır JSON; kişisel veri süzgeci: hata mesajı yazılmaz
// (Postgres "duplicate key" ayrıntısı e-posta gibi değer taşıyabilir), yalnız olay adı, hata sınıfı ve varsa SQLSTATE.
// Portalda ortak log yardımcısı yok (durum.md açık konu 11); bu yardımcı satış portalıyla sınırlıdır, ortaklaştırılması o işte.
export function hataGunlugu(olay: string, e: unknown) {
  const kod = typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string' ? e.code : undefined;
  console.error(JSON.stringify({ zaman: new Date().toISOString(), uygulama: 'satis', olay, hata: e instanceof Error ? e.name : typeof e, ...(kod ? { kod } : {}) }));
}
