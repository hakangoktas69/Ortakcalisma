// Kurum hesabının canlı durumu (firma listesindeki G/S kutuları). Kanıt yalnız kurumda başarılı giriştir: şifrenin kayıtlı
// olması "aktif" sayılmaz; bilgiler başarılı girişten sonra değiştiyse yeni bilgi doğrulanana dek durum bilinmez.

export type LiveState = 'active' | 'inactive' | 'unknown';
export type LiveStatus = { state: LiveState; checkedAt: string | null };

type AccountLike = { status: 'active' | 'wrong_password' | 'locked' | 'disabled'; updatedAt: string; lastSuccessAt: string | null };

export function liveStatus(a: AccountLike | undefined): LiveStatus {
  if (!a) return { state: 'unknown', checkedAt: null };
  if (a.status !== 'active') return { state: 'inactive', checkedAt: a.updatedAt };
  const basari = a.lastSuccessAt ? Date.parse(a.lastSuccessAt) : NaN;
  const kayit = Date.parse(a.updatedAt);
  if (Number.isFinite(basari) && Number.isFinite(kayit) && basari >= kayit) return { state: 'active', checkedAt: a.lastSuccessAt };
  return { state: 'unknown', checkedAt: null };
}

export const liveStatusLabel = (s: LiveState) => (s === 'active' ? 'Aktif' : s === 'inactive' ? 'Aktif değil' : 'Doğrulanmadı');

/** Birden çok hesabın tek kutuda gösterimi (SGK işyerleri): en kötü durum kazanır; hepsi aktifse en eski kontrol tarihi. */
export function combineLiveStatus(list: readonly LiveStatus[]): LiveStatus {
  const kotu = list.find((s) => s.state === 'inactive');
  if (kotu) return kotu;
  if (list.length === 0 || list.some((s) => s.state !== 'active')) return { state: 'unknown', checkedAt: null };
  return { state: 'active', checkedAt: [...list].map((s) => s.checkedAt ?? '').sort()[0] || null };
}
