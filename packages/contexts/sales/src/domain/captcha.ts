// Girişte resimli güvenlik kodu (D41; GİB / e-Devlet'teki gibi). İki adımlı doğrulaması kapalı hesapta ve kayıtsız
// e-postada parolaya bakılmadan önce istenir: otomatik parola denemesi kodu çözmeden ilerleyemez. Saf kurallar.

export const CAPTCHA_LENGTH = 5;
export const CAPTCHA_TTL_SECONDS = 300;
/** Karışabilen karakterler (0/O, 1/I/L, Q) yok; büyük/küçük harf ayrımı yapılmaz. */
export const CAPTCHA_CHARS = 'ABCDEFGHJKMNPRSTUVWXYZ23456789';

/** Kullanıcının yazdığını karşılaştırılabilir hâle getirir: boşluk atılır, büyük harf (Türkçe i/ı da I olur). */
export const normalizeCaptcha = (s: string) => s.replace(/\s/g, '').replace(/[ıi]/g, 'I').toUpperCase();

/** Sabit sürede karşılaştırma (uzunluk farklıysa da yanlış); boş beklenen değer hiçbir şeyle eşleşmez. */
export function captchaMatches(expected: string, given: string): boolean {
  const a = normalizeCaptcha(expected);
  const b = normalizeCaptcha(given);
  if (!a || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

/** Bu girişte güvenlik kodu gerekir mi: iki adımlı doğrulaması açık olmayan ya da bulunamayan hesap. */
export const loginNeedsCaptcha = (user: { totpEnabledAt: Date | null } | null) => !user?.totpEnabledAt;
