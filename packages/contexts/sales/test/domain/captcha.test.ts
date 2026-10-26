import { describe, expect, it } from 'vitest';
import { CAPTCHA_CHARS, captchaMatches, loginNeedsCaptcha, normalizeCaptcha } from '../../src/index.ts';

describe('girişte resimli güvenlik kodu (D41)', () => {
  it('2FA\'sı açık olmayan ya da bulunamayan hesapta istenir; 2FA\'lı hesapta istenmez', () => {
    expect(loginNeedsCaptcha(null)).toBe(true);
    expect(loginNeedsCaptcha({ totpEnabledAt: null })).toBe(true);
    expect(loginNeedsCaptcha({ totpEnabledAt: new Date('2026-10-26T09:00:00Z') })).toBe(false);
  });

  it('büyük/küçük harf, boşluk ve Türkçe i/ı farkı önemsizdir', () => {
    expect(normalizeCaptcha(' ab c ')).toBe('ABC');
    expect(normalizeCaptcha('ıi')).toBe('II');
    expect(captchaMatches('KM7XA', 'km7 xa')).toBe(true);
    expect(captchaMatches('KMIXA', 'kmıxa')).toBe(true);
  });

  it('yanlış, eksik ya da uzun yanıt reddedilir; boş beklenen değer hiçbir yanıtla eşleşmez', () => {
    expect(captchaMatches('KM7XA', 'KM7XB')).toBe(false);
    expect(captchaMatches('KM7XA', 'KM7X')).toBe(false);
    expect(captchaMatches('KM7XA', 'KM7XAA')).toBe(false);
    expect(captchaMatches('', '')).toBe(false);
  });

  it('karışabilen karakterler (0/O, 1/I/L, Q) kod alfabesinde yok', () => {
    for (const c of '01OILQ') expect(CAPTCHA_CHARS).not.toContain(c);
  });
});
