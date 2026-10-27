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
