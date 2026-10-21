import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

// "Şifremi unuttum" kuralları (saf). Kullanıcı e-postasını ya da cep telefonunu yazar; o kanala 6 haneli kod gider.
// Kod 10 dakika geçerli, en fazla 5 yanlış deneme; aynı kişiye 60 saniyede bir yeni kod.
// Veritabanında kodun kendisi değil, kullanıcıya bağlı HMAC özeti tutulur (veritabanı sızsa da kod okunamaz).

export const RESET_CODE_TTL_MINUTES = 10;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_RESEND_SECONDS = 60;

export type ResetIdentifier = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

/** Türkiye cep telefonu → "905xxxxxxxxx" (SMS gidebilecek numara); değilse null. */
export function normalizeMobile(raw: string): string | null {
  let d = raw.replace(/[\s()+\-.]/g, '');
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('5')) d = '90' + d;
  if (d.length === 11 && d.startsWith('05')) d = '9' + d;
  return /^905\d{9}$/.test(d) ? d : null;
}

/** Kullanıcının yazdığı: "@" içeriyorsa e-posta, değilse cep telefonu. Anlaşılmıyorsa null. */
export function parseIdentifier(input: string): ResetIdentifier | null {
  const s = input.trim();
  if (s.includes('@')) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? { kind: 'email', value: s.toLowerCase() } : null;
  const phone = normalizeMobile(s);
  return phone ? { kind: 'phone', value: phone } : null;
}

export const generateResetCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Kod özeti kullanıcıya bağlıdır: aynı kod başka kullanıcının özetiyle eşleşmez. */
export const hashResetCode = (secret: string, userId: string, code: string) =>
  createHmac('sha256', secret).update(`password-reset:${userId}:${code}`).digest('hex');

export interface ResetState {
  passwordResetHash: string | null;
  passwordResetExpires: Date | null;
  passwordResetAttempts: number;
  passwordResetSentAt: Date | null;
}

/** Yeni kod gönderilebilir mi (son koddan bu yana en az 60 sn). */
export const canSendCode = (s: Pick<ResetState, 'passwordResetSentAt'>, now = new Date()) =>
  !s.passwordResetSentAt || now.getTime() - s.passwordResetSentAt.getTime() >= RESET_RESEND_SECONDS * 1000;

export type CodeCheck = 'ok' | 'wrong' | 'expired' | 'none' | 'locked';

/** Kodu denetler. 'wrong' dönerse çağıran deneme sayısını artırır. */
export function checkResetCode(s: ResetState, expectedHash: string, now = new Date()): CodeCheck {
  if (!s.passwordResetHash || !s.passwordResetExpires) return 'none';
  if (s.passwordResetAttempts >= RESET_MAX_ATTEMPTS) return 'locked';
  if (s.passwordResetExpires <= now) return 'expired';
  const a = Buffer.from(s.passwordResetHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'wrong';
}

/** E-posta ve telefonu ekranda kısmen gösterir: "ay***@yi***.com", "+90 5** *** ** 67". */
export function maskTarget(id: ResetIdentifier): string {
  if (id.kind === 'phone') return `+90 5** *** ** ${id.value.slice(-2)}`;
  const [user, domain] = id.value.split('@');
  const [host, ...rest] = domain.split('.');
  return `${user.slice(0, 2)}***@${host.slice(0, 2)}***.${rest.join('.')}`;
}
