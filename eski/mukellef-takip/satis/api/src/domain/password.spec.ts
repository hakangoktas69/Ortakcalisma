import { generateTempPassword, passwordProblem } from './password.js';

describe('passwordProblem', () => {
  it('kısa şifreyi reddeder', () => expect(passwordProblem('abc123')).toMatch(/10 karakter/));
  it('rakamsız şifreyi reddeder', () => expect(passwordProblem('sadeceharfler')).toMatch(/harf ve rakam/));
  it('harfsiz şifreyi reddeder', () => expect(passwordProblem('1234567890')).toMatch(/harf ve rakam/));
  it('Türkçe harfi harf sayar', () => expect(passwordProblem('çğışöü12345')).toBeNull());
  it('kurala uyan şifreyi kabul eder', () => expect(passwordProblem('Satis2026guvenli')).toBeNull());
});

describe('generateTempPassword', () => {
  it('12 karakter, kurala uygun ve karışabilen karakter içermez', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw).toHaveLength(12);
      expect(passwordProblem(pw)).toBeNull();
      expect(pw).not.toMatch(/[01oOlI]/);
    }
  });
  it('her seferinde farklıdır', () => {
    const set = new Set(Array.from({ length: 50 }, generateTempPassword));
    expect(set.size).toBe(50);
  });
});
