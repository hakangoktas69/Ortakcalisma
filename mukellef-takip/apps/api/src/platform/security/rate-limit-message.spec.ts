import { rateLimitMessage } from './rate-limit-message.js';

describe('rateLimitMessage', () => {
  it('engel süresini dakikaya yuvarlar', () => {
    expect(rateLimitMessage({ isBlocked: true, timeToBlockExpire: 900 })).toBe('Çok fazla deneme yaptınız. Güvenliğiniz için 15 dakika sonra tekrar deneyin.');
    expect(rateLimitMessage({ isBlocked: true, timeToBlockExpire: 61 })).toMatch(/2 dakika/);
    expect(rateLimitMessage({ isBlocked: true, timeToBlockExpire: 5 })).toMatch(/1 dakika/);
  });
  it('engel yoksa genel mesaj', () => {
    expect(rateLimitMessage({ isBlocked: false, timeToBlockExpire: 0 })).toBe('Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.');
    expect(rateLimitMessage({ isBlocked: true, timeToBlockExpire: 0 })).toMatch(/Biraz bekleyip/);
  });
  it('İngilizce kütüphane metni içermez', () => {
    expect(rateLimitMessage({ isBlocked: true, timeToBlockExpire: 900 })).not.toMatch(/Throttler|Too Many/);
  });
});
