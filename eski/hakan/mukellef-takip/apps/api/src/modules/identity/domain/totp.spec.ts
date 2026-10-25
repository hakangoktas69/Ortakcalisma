import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateRecoveryCodes, generateSecret, hashRecoveryCode, hotp, otpauthUri, stepAt, verifyTotp } from './totp.js';

// RFC 6238 Ek B test değerleri (SHA-1, anahtar "12345678901234567890"); 8 haneli değerlerin son 6 hanesi
const RFC_SECRET = Buffer.from('12345678901234567890');
const RFC_SECRET_B32 = base32Encode(RFC_SECRET);

describe('base32', () => {
  it('RFC 4648 örneği', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
  });
  it('gidiş-dönüş', () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });
});

describe('hotp / totp (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('t=%i → %s', (t, code) => {
    expect(hotp(RFC_SECRET, stepAt(t * 1000))).toBe(code);
    expect(verifyTotp(RFC_SECRET_B32, code, t * 1000)).toBe(stepAt(t * 1000));
  });

  it('±1 adım saat kaymasını kabul eder, daha fazlasını etmez', () => {
    const t = 1111111109 * 1000;
    expect(verifyTotp(RFC_SECRET_B32, '081804', t + 30_000)).not.toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, '081804', t + 90_000)).toBeNull();
  });

  it('aynı kod (aynı adım) ikinci kez kullanılamaz', () => {
    const t = 59 * 1000;
    const step = verifyTotp(RFC_SECRET_B32, '287082', t);
    expect(step).not.toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, '287082', t, step)).toBeNull();
  });

  it('biçimsiz kodları reddeder', () => {
    expect(verifyTotp(RFC_SECRET_B32, '12345', 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET_B32, 'abcdef', 0)).toBeNull();
  });
});

describe('otpauthUri', () => {
  it('uygulamaların beklediği biçim', () => {
    const u = otpauthUri('JBSWY3DPEHPK3PXP', 'demo@mukellef.test');
    expect(u.startsWith('otpauth://totp/M%C3%BCkellef%20Takip%3Ademo%40mukellef.test?')).toBe(true);
    expect(u).toContain('secret=JBSWY3DPEHPK3PXP');
  });
});

describe('kurtarma kodları', () => {
  it('10 benzersiz kod, özet büyük/küçük harf ve boşluğa duyarsız', () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(hashRecoveryCode(codes[0].toUpperCase())).toBe(hashRecoveryCode(` ${codes[0]} `));
  });
});
