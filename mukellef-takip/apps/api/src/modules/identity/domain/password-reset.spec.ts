import {
  canSendCode,
  checkResetCode,
  generateResetCode,
  hashResetCode,
  maskTarget,
  normalizeMobile,
  parseIdentifier,
  RESET_MAX_ATTEMPTS,
  type ResetState,
} from './password-reset.js';

const now = new Date('2026-10-21T10:00:00Z');
const later = (s: number) => new Date(now.getTime() + s * 1000);

describe('parseIdentifier', () => {
  it('e-postayı küçük harfe çevirir', () => expect(parseIdentifier('  Ayse@Ornek.TEST ')).toEqual({ kind: 'email', value: 'ayse@ornek.test' }));
  it('bozuk e-postayı reddeder', () => expect(parseIdentifier('ayse@')).toBeNull());
  it.each(['0532 123 45 67', '+90 (532) 123-45-67', '5321234567', '00905321234567'])('cep telefonu: %s', (s) =>
    expect(parseIdentifier(s)).toEqual({ kind: 'phone', value: '905321234567' }),
  );
  it.each(['0212 555 66 77', '123', 'abc', ''])('cep telefonu değil: %s', (s) => expect(parseIdentifier(s)).toBeNull());
  it('normalizeMobile harf içeren girdiyi reddeder', () => expect(normalizeMobile('05x2 123')).toBeNull());
});

describe('kod', () => {
  it('6 haneli, baştaki sıfır korunur', () => {
    for (let i = 0; i < 200; i++) expect(generateResetCode()).toMatch(/^\d{6}$/);
  });
  it('özet kullanıcıya bağlıdır', () => {
    expect(hashResetCode('s', 'u1', '123456')).toBe(hashResetCode('s', 'u1', '123456'));
    expect(hashResetCode('s', 'u1', '123456')).not.toBe(hashResetCode('s', 'u2', '123456'));
    expect(hashResetCode('s', 'u1', '123456')).not.toBe(hashResetCode('t', 'u1', '123456'));
  });
});

describe('checkResetCode', () => {
  const hash = hashResetCode('s', 'u1', '123456');
  const state = (over: Partial<ResetState> = {}): ResetState => ({
    passwordResetHash: hash,
    passwordResetExpires: later(600),
    passwordResetAttempts: 0,
    passwordResetSentAt: now,
    ...over,
  });
  it('doğru kod', () => expect(checkResetCode(state(), hash, now)).toBe('ok'));
  it('yanlış kod', () => expect(checkResetCode(state(), hashResetCode('s', 'u1', '000000'), now)).toBe('wrong'));
  it('istenmemiş kod', () => expect(checkResetCode(state({ passwordResetHash: null }), hash, now)).toBe('none'));
  it('süresi dolmuş', () => expect(checkResetCode(state({ passwordResetExpires: now }), hash, now)).toBe('expired'));
  it('deneme hakkı bitmiş (doğru kod da reddedilir)', () =>
    expect(checkResetCode(state({ passwordResetAttempts: RESET_MAX_ATTEMPTS }), hash, now)).toBe('locked'));
  it('bozuk özet uzunluğu eşleşmez', () => expect(checkResetCode(state({ passwordResetHash: 'ab' }), hash, now)).toBe('wrong'));
});

describe('canSendCode', () => {
  it('ilk kez gönderilir', () => expect(canSendCode({ passwordResetSentAt: null }, now)).toBe(true));
  it('60 sn dolmadan gönderilmez', () => expect(canSendCode({ passwordResetSentAt: now }, later(59))).toBe(false));
  it('60 sn sonra gönderilir', () => expect(canSendCode({ passwordResetSentAt: now }, later(60))).toBe(true));
});

describe('maskTarget', () => {
  it('e-posta', () => expect(maskTarget({ kind: 'email', value: 'ayse@yilmaz-mm.com.tr' })).toBe('ay***@yi***.com.tr'));
  it('telefon', () => expect(maskTarget({ kind: 'phone', value: '905321234567' })).toBe('+90 5** *** ** 67'));
});
