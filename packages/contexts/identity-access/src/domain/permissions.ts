// Hiyerarşik yetki (05 §3, D17): yetki ağacı = özellik ağacı (feature-registry). Üst düğüme verilen yetki alt düğümlere
// miras kalır; alt düğümde açık engelleme (deny) olabilir. Etkin yetki = rol şablonu ∪ kişiye özel izin − kişiye özel engel.

export const ROLES = ['ofis_admin', 'musavir', 'personel', 'mukellef'] as const;
export type Role = (typeof ROLES)[number];

export type Override = { readonly key: string; readonly effect: 'allow' | 'deny' };

/** Bir kural kümesi: izin verilen ve engellenen düğümler (anahtar ya da önek). */
export type Grants = { readonly allow: readonly string[]; readonly deny: readonly string[] };

// Rol şablonları (05 §3.2). Anahtarlar feature-registry düğümleridir; modül anahtarı tüm alt ağacı kapsar.
const BUSINESS = ['oturum', 'genel_bakis', 'firmalar', 'beyanname', 'tebligat', 'sgk', 'edefter', 'dilekceler', 'faturalar', 'gorevler', 'notlar', 'kisayollar', 'bildirimler', 'raporlar', 'odeme', 'ayarlar', 'destek'];

export const ROLE_TEMPLATES: Readonly<Record<Role, Grants>> = {
  // Tümü, sistem yönetimi (kurum hız politikası) ve satış portalı hariç
  ofis_admin: { allow: [...BUSINESS, 'yonetim'], deny: ['yonetim.hiz_politikasi'] },
  // İş yetkilerinin tümü + kendi personelini yönetme
  musavir: { allow: [...BUSINESS, 'yonetim.kullanicilar', 'yonetim.mukellef_kullanicilari', 'yonetim.zamanlama.view'], deny: ['genel_bakis.takvim.edit'] },
  // Görüntüleme + görev/not. Senkron başlatma ve kurum bilgisi girme kapalı (müşavir izin verebilir)
  personel: {
    allow: ['oturum', 'genel_bakis', 'firmalar.liste', 'firmalar.kart.view', 'firmalar.kurum_hesaplari.view_status', 'firmalar.gib_sozlesmeler.view',
      'beyanname.liste', 'beyanname.kontrol', 'beyanname.belge', 'sgk.kontrol', 'sgk.ebildirge.view', 'sgk.ebildirge.download', 'tebligat.liste.view', 'gorevler', 'notlar', 'kisayollar', 'bildirimler', 'ayarlar.profil'],
    deny: ['genel_bakis.takvim.edit', 'genel_bakis.takvim.sync'],
  },
  // Kendi firmasında görüntüleme, belge indirme, kendi hesap bilgisini girme ve onay
  mukellef: {
    allow: ['oturum', 'genel_bakis.panel', 'firmalar.kart.view', 'firmalar.kurum_hesaplari.view_status', 'firmalar.kurum_hesaplari.edit_credentials',
      'firmalar.kurum_hesaplari.consent', 'beyanname.liste.view', 'beyanname.belge', 'sgk.ebildirge.view', 'sgk.ebildirge.download', 'tebligat.liste.view', 'ayarlar.profil'],
    deny: [],
  },
};

/** `key` düğümü `node`'un kendisi ya da altında mı? */
export const covers = (node: string, key: string) => key === node || key.startsWith(`${node}.`);

/** En özel (en uzun) eşleşen kural kazanır; eşitlikte engel kazanır. Eşleşme yoksa yetki yok. */
export function isAllowed(grants: Grants, key: string): boolean {
  let best = -1;
  let allowed = false;
  for (const n of grants.allow) if (covers(n, key) && n.length > best) [best, allowed] = [n.length, true];
  for (const n of grants.deny) if (covers(n, key) && n.length >= best) [best, allowed] = [n.length, false];
  return allowed;
}

export function effectiveGrants(role: Role, overrides: readonly Override[] = []): Grants {
  const t = ROLE_TEMPLATES[role];
  return {
    allow: [...t.allow, ...overrides.filter((o) => o.effect === 'allow').map((o) => o.key)],
    deny: [...t.deny, ...overrides.filter((o) => o.effect === 'deny').map((o) => o.key)],
  };
}

/**
 * Yetki yükseltme yasağı (05 §3.3): veren, sahip olmadığı bir yetkiyi veremez; personel ve mükellef hiç yetki veremez.
 * Dönüş: verilemeyen anahtarlar (boşsa izin var).
 */
export function escalations(granter: { role: Role; grants: Grants }, requested: readonly Override[]): string[] {
  if (granter.role === 'personel' || granter.role === 'mukellef') return requested.map((o) => o.key);
  return requested.filter((o) => o.effect === 'allow' && !isAllowed(granter.grants, o.key)).map((o) => o.key);
}
