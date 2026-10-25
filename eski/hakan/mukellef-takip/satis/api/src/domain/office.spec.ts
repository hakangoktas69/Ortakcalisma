import { addDays, extendLicense, findPlan, formatPhone, normalizePhone, officeStatus } from './office.js';

const now = new Date('2026-10-21T10:00:00Z');

describe('officeStatus', () => {
  const trialEndsAt = addDays(now, 14);
  it('dondurulmuş büro her durumda donduruldu', () =>
    expect(officeStatus({ suspendedAt: now, expiresAt: addDays(now, 100), trialEndsAt: null }, now)).toBe('donduruldu'));
  it('lisansı olmayan ya da bitmiş büro süresi doldu', () => {
    expect(officeStatus({ suspendedAt: null, expiresAt: null, trialEndsAt: null }, now)).toBe('suresi-doldu');
    expect(officeStatus({ suspendedAt: null, expiresAt: now, trialEndsAt }, now)).toBe('suresi-doldu');
  });
  it('deneme bitişini aşmayan lisans denemedir', () =>
    expect(officeStatus({ suspendedAt: null, expiresAt: trialEndsAt, trialEndsAt }, now)).toBe('deneme'));
  it('deneme bitişinden ileri uzatılmış lisans aktiftir', () =>
    expect(officeStatus({ suspendedAt: null, expiresAt: addDays(trialEndsAt, 30), trialEndsAt }, now)).toBe('aktif'));
  it('deneme kaydı olmayan büro lisansı sürüyorsa aktiftir', () =>
    expect(officeStatus({ suspendedAt: null, expiresAt: addDays(now, 1), trialEndsAt: null }, now)).toBe('aktif'));
});

describe('extendLicense', () => {
  it('gün ekler: süre bitmemişse bitişin üzerine', () =>
    expect(extendLicense(addDays(now, 5), { days: 10 }, now)).toEqual(addDays(now, 15)));
  it('gün ekler: süre bittiyse bugünden', () => expect(extendLicense(addDays(now, -5), { days: 10 }, now)).toEqual(addDays(now, 10)));
  it('lisans hiç yoksa bugünden', () => expect(extendLicense(null, { days: 3 }, now)).toEqual(addDays(now, 3)));
  it('ay ekler (ödeme kuralı)', () => {
    const r = extendLicense(new Date('2026-11-30T10:00:00Z'), { months: 1 }, now);
    expect(r.getMonth()).toBe(11);
  });
  it('süre verilmezse değiştirmez', () => expect(extendLicense(addDays(now, 5), {}, now)).toEqual(addDays(now, 5)));
});

describe('findPlan', () => {
  it('bilinen paketi bulur', () => expect(findPlan('pro')?.name).toBe('Pro'));
  it('bilinmeyeni null döner', () => expect(findPlan('yok')).toBeNull());
});

describe('normalizePhone', () => {
  it.each([
    ['0532 123 45 67', '905321234567'],
    ['+90 (532) 123-45-67', '905321234567'],
    ['5321234567', '905321234567'],
    ['00905321234567', '905321234567'],
    ['0212 555 66 77', '902125556677'],
  ])('%s → %s', (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(['', 'abc', '123', '0132 123 45 67', '+1 555 123 4567'])('geçersiz: %s', (input) => expect(normalizePhone(input)).toBeNull());
});

describe('formatPhone', () => {
  it('okunur biçim', () => expect(formatPhone('905321234567')).toBe('+90 532 123 45 67'));
  it('boş ya da beklenmedik değeri olduğu gibi bırakır', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('12345')).toBe('12345');
  });
});
