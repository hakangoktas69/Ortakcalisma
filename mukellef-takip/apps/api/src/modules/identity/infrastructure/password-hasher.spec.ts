import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from './password-hasher.js';

describe('şifre özeti', () => {
  it('argon2id üretir ve doğrular', async () => {
    const h = await hashPassword('Guclu-Sifre-2026');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(h, 'Guclu-Sifre-2026')).toBe(true);
    expect(await verifyPassword(h, 'yanlis')).toBe(false);
    expect(needsRehash(h)).toBe(false);
  });

  it('eski bcrypt özetini doğrular ve dönüştürülmesini ister', async () => {
    const old = await bcrypt.hash('Demo1234!', 4);
    expect(await verifyPassword(old, 'Demo1234!')).toBe(true);
    expect(await verifyPassword(old, 'x')).toBe(false);
    expect(needsRehash(old)).toBe(true);
  });

  it('bozuk özet hata fırlatmaz, false döner', async () => {
    expect(await verifyPassword('$argon2id$bozuk', 'x')).toBe(false);
  });
});
