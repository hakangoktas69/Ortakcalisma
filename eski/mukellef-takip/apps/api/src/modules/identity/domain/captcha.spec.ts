import { CAPTCHA_CHARS, captchaMatches, loginNeedsCaptcha, normalizeCaptcha } from './captcha.js';

describe('güvenlik kodu', () => {
  it('büyük-küçük harf ve boşluk fark etmez', () => {
    expect(captchaMatches('AB3KX', 'ab3kx')).toBe(true);
    expect(captchaMatches('AB3KX', ' ab 3kx ')).toBe(true);
  });
  it('Türkçe klavyede yazılan i ve ı büyük I sayılır', () => expect(normalizeCaptcha('ıi')).toBe('II'));
  it('yanlış ya da eksik kod eşleşmez', () => {
    expect(captchaMatches('AB3KX', 'AB3KY')).toBe(false);
    expect(captchaMatches('AB3KX', 'AB3K')).toBe(false);
    expect(captchaMatches('AB3KX', '')).toBe(false);
  });
  it('karışabilen karakter içermez', () => expect(CAPTCHA_CHARS).not.toMatch(/[01OIQL]/));
  it('iki adımlı doğrulaması açık olana sorulmaz; kapalıya ve kayıtsız e-postaya sorulur', () => {
    expect(loginNeedsCaptcha({ totpEnabledAt: new Date() })).toBe(false);
    expect(loginNeedsCaptcha({ totpEnabledAt: null })).toBe(true);
    expect(loginNeedsCaptcha(null)).toBe(true);
  });
});
