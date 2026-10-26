// Satış kullanıcısı (SalesUser) kuralları: art arda hatalı giriş kilidi ve parola kuralı. Saf: zaman parametreyle gelir.
// İki adımlı doğrulama zorunludur (D27); kod doğrulaması altyapıdadır (HMAC), oturum kuralı application'da.

export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;

export const isLocked = (lockedUntil: Date | null, now: Date) => !!lockedUntil && lockedUntil > now;

/** Hatalı denemeden sonraki sayaç; eşiğe ulaşınca kilit ve sayaç sıfırlanır. */
export function afterFailure(failedLogins: number, now: Date): { failedLogins: number; lockedUntil: Date | null } {
  const next = failedLogins + 1;
  if (next >= MAX_FAILED) return { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  return { failedLogins: next, lockedUntil: null };
}

/** Kurala uymuyorsa kullanıcıya gösterilecek açıklama, uyuyorsa null. Portal hesap açma kuralıyla aynı alt sınır (12). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return 'Parola en az 12 karakter olmalı.';
  if (pw.length > 128) return 'Parola en fazla 128 karakter olmalı.';
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(pw) || !/\d/.test(pw)) return 'Parola harf ve rakam içermeli.';
  return null;
}

export const validEmail = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
