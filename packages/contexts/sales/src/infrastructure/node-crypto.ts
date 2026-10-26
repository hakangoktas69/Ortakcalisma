import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import type { SalesCrypto } from '../application/sales-auth.ts';

// Satış kullanıcısının kriptografisi; yalnız node:crypto (yeni bağımlılık yok).
//  - Parola: scrypt (N=2^15, r=8, p=1, 32 bayt, 16 bayt tuz; OWASP alt sınırının üstü).
//  - TOTP (RFC 6238): SHA-1, 6 hane, 30 sn; ±1 adım saat kayması. Google/Microsoft Authenticator uyumlu.
//  - TOTP gizli anahtarı veritabanında AES-256-GCM ile mühürlü (SALES_TOTP_KEY); anahtar kaybolursa 2FA yeniden kurulur.

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ISSUER = 'Eworks Satış';
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Geçersiz base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** HOTP (RFC 4226): belirli bir sayaç için kod. */
export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const b = (i: number) => h[i] ?? 0;
  const offset = b(h.length - 1) & 0x0f;
  const bin = ((b(offset) & 0x7f) << 24) | (b(offset + 1) << 16) | (b(offset + 2) << 8) | b(offset + 3);
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

const scryptAsync = (pw: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) => scrypt(pw, salt, len, SCRYPT, (e, k) => (e ? reject(e) : resolve(k))));

const b64 = (b: Buffer) => b.toString('base64url');

export class NodeSalesCrypto implements SalesCrypto {
  private readonly key: Buffer;
  private dummy: Promise<string> | null = null;

  constructor(sealKey: string) {
    if (sealKey.length < 32) throw new Error('SALES_TOTP_KEY en az 32 karakter olmalı');
    this.key = createHash('sha256').update(sealKey).digest();
  }

  async hashPassword(pw: string): Promise<string> {
    const salt = randomBytes(16);
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${b64(salt)}$${b64(await scryptAsync(pw, salt, 32))}`;
  }

  async verifyPassword(hash: string | null, pw: string): Promise<boolean> {
    // Kullanıcı yoksa da aynı maliyette özet hesaplanır (zamanlama eşitleme)
    const stored = hash ?? (await (this.dummy ??= this.hashPassword('kullanici-yok-zamanlama-esitleme')));
    const [, n, , , salt, ozet] = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]+)\$([\w-]+)$/.exec(stored) ?? [];
    if (!salt || !ozet || Number(n) !== SCRYPT.N) return false;
    const expected = Buffer.from(ozet, 'base64url');
    const actual = await scryptAsync(pw, Buffer.from(salt, 'base64url'), expected.length);
    return hash !== null && actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  newTotpSecret(): string {
    return base32Encode(randomBytes(20)); // 160 bit, RFC 4226 önerisi
  }

  verifyTotp(secret: string, code: string, now: Date, lastStep: number | null): number | null {
    if (!/^\d{6}$/.test(code)) return null;
    const key = base32Decode(secret);
    const current = Math.floor(now.getTime() / 1000 / STEP_SECONDS);
    for (const step of [current, current - 1, current + 1]) {
      if (lastStep !== null && step <= lastStep) continue;
      if (timingSafeEqual(Buffer.from(hotp(key, step)), Buffer.from(code))) return step;
    }
    return null;
  }

  otpauthUri(secret: string, account: string): string {
    const label = `${encodeURIComponent(ISSUER)}:${encodeURIComponent(account)}`;
    const params = new URLSearchParams({ secret, issuer: ISSUER, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  /** 10 tek kullanımlık kod, "abcd-efgh" (karışabilen 0/o, 1/l yok). */
  newRecoveryCodes(): string[] {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const codes = new Set<string>();
    while (codes.size < 10) {
      const s = Array.from({ length: 8 }, () => chars.charAt(randomInt(chars.length))).join('');
      codes.add(`${s.slice(0, 4)}-${s.slice(4)}`);
    }
    return [...codes];
  }

  hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code.trim().toLowerCase().replace(/\s/g, '')).digest('hex');
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', b64(iv), b64(c.getAuthTag()), b64(ct)].join('.');
  }

  open(sealed: string): string {
    const [v, iv, tag, ct] = sealed.split('.');
    if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Mühür biçimi geçersiz');
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  }

  /** Geçici parola: 14 karakter, karışabilen karakter (0/O, 1/l/I) yok, en az bir harf ve bir rakam. */
  tempPassword(): string {
    const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const all = letters + digits;
    const pick = (set: string) => set.charAt(randomInt(set.length));
    const chars = [pick(letters), pick(digits)];
    while (chars.length < 14) chars.push(pick(all));
    // Fisher-Yates: ilk iki karakterin yeri tahmin edilemesin
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const t = chars[i] ?? '';
      chars[i] = chars[j] ?? '';
      chars[j] = t;
    }
    return chars.join('');
  }
}

/** Belirli bir adımın kodu (kabul testlerinde doğrulayıcı uygulamanın yerine; üretim kodu kullanmaz). */
export const totpCodeAt = (secret: string, step: number) => hotp(base32Decode(secret), step);
