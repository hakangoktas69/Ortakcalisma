import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, hotp, NodeSalesCrypto } from '../../src/infrastructure/node-crypto.ts';

// Kriptografi adaptörü birim testi (bağımlılıksız): RFC 4226 / 6238 test vektörleri, mühür, parola özeti.
const kripto = new NodeSalesCrypto('test-anahtari-en-az-otuz-iki-karakter-uzun');
const RFC_GIZLI = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238, Google/Microsoft Authenticator uyumlu)', () => {
  it('RFC 4226 HOTP test vektörleri', () => {
    const k = Buffer.from('12345678901234567890');
    expect([0, 1, 2, 3, 9].map((c) => hotp(k, c))).toEqual(['755224', '287082', '359152', '969429', '520489']);
  });

  it('RFC 6238 zaman vektörü (59. saniye → 94287082 son 6 hane)', () => {
    expect(kripto.verifyTotp(RFC_GIZLI, '287082', new Date(59_000), null)).toBe(1);
  });

  it('±1 adım saat kayması kabul edilir, ±2 edilmez; kullanılmış adım reddedilir; biçimsiz kod reddedilir', () => {
    const t = new Date(1_000 * 30 * 100 + 5_000);
    const k = Buffer.from(base32Decode(RFC_GIZLI));
    expect(kripto.verifyTotp(RFC_GIZLI, hotp(k, 99), t, null)).toBe(99);
    expect(kripto.verifyTotp(RFC_GIZLI, hotp(k, 101), t, null)).toBe(101);
    expect(kripto.verifyTotp(RFC_GIZLI, hotp(k, 102), t, null)).toBeNull();
    expect(kripto.verifyTotp(RFC_GIZLI, hotp(k, 100), t, 100)).toBeNull();
    expect(kripto.verifyTotp(RFC_GIZLI, '12345', t, null)).toBeNull();
    expect(kripto.verifyTotp(RFC_GIZLI, 'abcdef', t, null)).toBeNull();
  });

  it('yeni gizli anahtar 160 bit base32; otpauth adresi uygulama adını ve hesabı taşır', () => {
    const s = kripto.newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(s)).toHaveLength(20);
    expect(kripto.otpauthUri(s, 'satis@eworks.test')).toBe(`otpauth://totp/Eworks%20Sat%C4%B1%C5%9F:satis%40eworks.test?secret=${s}&issuer=Eworks+Sat%C4%B1%C5%9F&algorithm=SHA1&digits=6&period=30`);
    expect(() => base32Decode('1!')).toThrow();
  });
});

describe('mühür (AES-256-GCM)', () => {
  it('açılır; her mühür farklıdır; başka anahtarla ya da değiştirilmiş mühür açılmaz', () => {
    const a = kripto.seal('GIZLI');
    expect(a).not.toContain('GIZLI');
    expect(kripto.seal('GIZLI')).not.toBe(a);
    expect(kripto.open(a)).toBe('GIZLI');
    expect(() => new NodeSalesCrypto('baska-anahtar-en-az-otuz-iki-karakter-uzun').open(a)).toThrow();
    const [v, iv, tag, ct] = a.split('.');
    expect(() => kripto.open([v, iv, tag, `${ct}A`].join('.'))).toThrow();
    expect(() => kripto.open('bozuk')).toThrow();
  });

  it('kısa anahtarla oluşturulamaz', () => {
    expect(() => new NodeSalesCrypto('kisa')).toThrow();
  });
});

describe('parola ve kodlar', () => {
  it('scrypt özeti doğrulanır, her özet tuzludur; kullanıcı yoksa da doğrulama yapılır ve false döner', async () => {
    const h = await kripto.hashPassword('Parola-2026-uzun');
    expect(h).toMatch(/^scrypt\$/);
    expect(h).not.toContain('Parola');
    expect(await kripto.hashPassword('Parola-2026-uzun')).not.toBe(h);
    expect(await kripto.verifyPassword(h, 'Parola-2026-uzun')).toBe(true);
    expect(await kripto.verifyPassword(h, 'parola-2026-uzun')).toBe(false);
    expect(await kripto.verifyPassword(null, 'Parola-2026-uzun')).toBe(false);
    expect(await kripto.verifyPassword('bozuk-ozet', 'x')).toBe(false);
  });

  it('geçici parola 14 karakter, karışabilen karakter yok, harf ve rakam içerir', () => {
    for (let i = 0; i < 50; i++) {
      const p = kripto.tempPassword();
      expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{14}$/);
      expect(p).toMatch(/\d/);
      expect(p).toMatch(/[a-zA-Z]/);
    }
  });

  it('10 kurtarma kodu "abcd-efgh"; özet büyük/küçük harf ve boşluktan bağımsız', () => {
    const k = kripto.newRecoveryCodes();
    expect(k).toHaveLength(10);
    for (const c of k) expect(c).toMatch(/^[a-km-z2-9]{4}-[a-km-z2-9]{4}$/);
    expect(new Set(k).size).toBe(10);
    expect(kripto.hashRecoveryCode(' ABCD-efgh ')).toBe(kripto.hashRecoveryCode('abcd-efgh'));
  });
});
