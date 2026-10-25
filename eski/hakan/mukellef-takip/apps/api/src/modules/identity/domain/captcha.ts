import { timingSafeEqual } from 'node:crypto';

// Girişte resimli güvenlik kodu (GİB / e-Devlet'teki gibi). İki adımlı doğrulaması kapalı hesaplarda (ve kayıtsız
// e-postada) şifreye bakılmadan önce istenir: otomatik şifre deneme, kodu çözmeden ilerleyemez.

export const CAPTCHA_LENGTH = 5;
export const CAPTCHA_TTL_SECONDS = 300;
/** Karışabilen karakterler (0/O, 1/I/L, Q) yok; büyük-küçük harf ayrımı yapılmaz */
export const CAPTCHA_CHARS = 'ABCDEFGHJKMNPRSTUVWXYZ23456789';

/** Kullanıcının yazdığını karşılaştırılabilir hâle getirir: boşluk atılır, büyük harf (Türkçe i/ı da I olur). */
export const normalizeCaptcha = (s: string) =>
  s
    .replace(/\s/g, '')
    .replace(/[ıi]/g, 'I')
    .toUpperCase();

/** Sabit sürede karşılaştırma (uzunluk farklıysa da yanlış) */
export function captchaMatches(expected: string, given: string): boolean {
  const a = Buffer.from(normalizeCaptcha(expected));
  const b = Buffer.from(normalizeCaptcha(given));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Bu girişte güvenlik kodu gerekir mi: iki adımlı doğrulaması açık olmayan ya da bulunamayan hesap. */
export const loginNeedsCaptcha = (user: { totpEnabledAt: Date | null } | null) => !user?.totpEnabledAt;
