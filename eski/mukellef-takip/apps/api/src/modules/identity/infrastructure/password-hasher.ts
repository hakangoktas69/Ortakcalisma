import { hash, verify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

// Şifre özeti: argon2id (OWASP önerisi: 19 MiB bellek, 2 tur). Eski bcrypt özetleri ("$2…") doğrulanmaya
// devam eder ve başarılı girişte argon2id'ye dönüştürülür (needsRehash).
// algorithm 2 = Argon2id (paketin const enum'u isolatedModules ile kullanılamıyor)
const ARGON2 = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => hash(pw, ARGON2);

export async function verifyPassword(stored: string, pw: string): Promise<boolean> {
  if (stored.startsWith('$2')) return bcrypt.compare(pw, stored);
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}

/** Özet eski algoritmayla mı (bcrypt) ya da eski parametrelerle mi üretilmiş? */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`$argon2id$v=19$m=${ARGON2.memoryCost},t=${ARGON2.timeCost},p=${ARGON2.parallelism}$`);
}

let dummy: Promise<string> | null = null;
/** Kayıtlı olmayan e-postada da aynı maliyette doğrulama yapmak için gerçek bir özet (zamanlama eşitleme). */
export function dummyHash() {
  dummy ??= hashPassword('kullanici-yok-zamanlama-esitleme');
  return dummy;
}
