import { randomInt } from 'node:crypto';

// Şifre kuralı müşavir sitesiyle aynıdır (apps/api identity): satışın verdiği geçici şifre orada da geçerli olmalı.

/** Kurala uymuyorsa kullanıcıya gösterilecek açıklama, uyuyorsa null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Şifre en az 10 karakter olmalı';
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(pw) || !/\d/.test(pw)) return 'Şifre harf ve rakam içermeli';
  return null;
}

/** Geçici şifre: 12 karakter, karışabilen karakterler (0/O, 1/l/I) yok, en az bir harf ve bir rakam. */
export function generateTempPassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
