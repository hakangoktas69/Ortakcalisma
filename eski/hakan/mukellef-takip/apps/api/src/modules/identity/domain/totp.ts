import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// TOTP (RFC 6238) — Google Authenticator, Microsoft Authenticator vb. ile uyumlu:
// SHA-1, 6 hane, 30 saniyelik adım. Saat kaymasına karşı ±1 adım kabul edilir.

const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

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
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
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

/** HOTP (RFC 4226) — belirli bir sayaç için kod. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const stepAt = (unixMs: number) => Math.floor(unixMs / 1000 / STEP_SECONDS);

export function generateSecret(): string {
  return base32Encode(randomBytes(20)); // 160 bit, RFC 4226 önerisi
}

/** Kimlik doğrulayıcı uygulamaların QR koddan okuduğu adres. */
export function otpauthUri(secretBase32: string, account: string, issuer = 'Mükellef Takip'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Kodu doğrular. Geçerliyse kullanılan adımı döner (tekrar kullanımı engellemek için saklanır), değilse null.
 * lastStep verilirse o adım ve öncesi reddedilir: aynı kod iki kez kullanılamaz.
 */
export function verifyTotp(secretBase32: string, code: string, nowMs = Date.now(), lastStep?: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = stepAt(nowMs);
  for (const step of [current, current - 1, current + 1]) {
    if (lastStep != null && step <= lastStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

/** 10 adet tek kullanımlık kurtarma kodu: "abcd-efgh" biçiminde (karışabilen 0/o, 1/l harfleri yok). */
export function generateRecoveryCodes(n = 10): string[] {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    const s = [...b].map((x) => chars[x % chars.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4, 8)}`;
  });
}

export const hashRecoveryCode = (code: string) =>
  createHash('sha256').update(code.trim().toLowerCase().replace(/\s/g, '')).digest('hex');
