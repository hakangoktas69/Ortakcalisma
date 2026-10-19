import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CF_INITIALIZE_PATH, iyzicoAuthHeader, iyzicoPrice, verdictFromRetrieve } from './iyzico.client.js';

describe('iyzicoAuthHeader (IYZWSv2)', () => {
  it('dokümandaki yapı: IYZWSv2 base64(apiKey:..&randomKey:..&signature:hex)', () => {
    const body = JSON.stringify({ locale: 'tr', price: '1' });
    const h = iyzicoAuthHeader('api-anahtari', 'gizli', '1722246017090123456789', CF_INITIALIZE_PATH, body);
    expect(h.startsWith('IYZWSv2 ')).toBe(true);
    expect(h.split(' ')).toHaveLength(2); // tek boşluk
    const decoded = Buffer.from(h.slice(8), 'base64').toString('utf8');
    const expectedSig = createHmac('sha256', 'gizli').update('1722246017090123456789' + CF_INITIALIZE_PATH + body).digest('hex');
    expect(decoded).toBe(`apiKey:api-anahtari&randomKey:1722246017090123456789&signature:${expectedSig}`);
    expect(expectedSig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gövdedeki tek karakter değişince imza değişir', () => {
    const a = iyzicoAuthHeader('k', 's', 'r', '/p', '{"a":1}');
    const b = iyzicoAuthHeader('k', 's', 'r', '/p', '{"a":2}');
    expect(a).not.toBe(b);
  });
});

describe('iyzicoPrice', () => {
  it('kuruş hassasiyeti, gereksiz sıfırsız', () => {
    expect(iyzicoPrice(15300)).toBe('15300');
    expect(iyzicoPrice(8550.5)).toBe('8550.5');
    expect(iyzicoPrice(1.005)).toBe('1.01');
    expect(iyzicoPrice(0.1 + 0.2)).toBe('0.3');
  });
});

describe('verdictFromRetrieve', () => {
  const expected = { paymentId: 'pay_1', amount: 15300, currency: 'TRY' };
  const ok = { status: 'success', paymentStatus: 'SUCCESS', fraudStatus: 1, paidPrice: 15300, currency: 'TRY', basketId: 'pay_1', conversationId: 'pay_1', paymentId: '2233' };

  it('her şey tutarsa onaylanır', () => {
    expect(verdictFromRetrieve(ok, expected)).toEqual({ outcome: 'PAID', paymentId: '2233', fraudStatus: 1 });
    expect(verdictFromRetrieve({ ...ok, paidPrice: '15300.0' }, expected).outcome).toBe('PAID');
  });

  it('tutar farklıysa reddedilir (kuruş farkı dahil)', () => {
    expect(verdictFromRetrieve({ ...ok, paidPrice: 15299.99 }, expected)).toMatchObject({ outcome: 'FAILED' });
    expect(verdictFromRetrieve({ ...ok, paidPrice: 1 }, expected).outcome).toBe('FAILED');
  });

  it('başka bir ödemenin token\'ı ile onaylanamaz', () => {
    expect(verdictFromRetrieve({ ...ok, basketId: 'pay_2' }, expected).outcome).toBe('FAILED');
    expect(verdictFromRetrieve({ ...ok, conversationId: 'pay_2' }, expected).outcome).toBe('FAILED');
  });

  it('ödeme başarısız veya istek başarısız', () => {
    expect(verdictFromRetrieve({ ...ok, paymentStatus: 'FAILURE' }, expected).outcome).toBe('FAILED');
    expect(verdictFromRetrieve({ status: 'failure', errorMessage: 'Geçersiz token' }, expected)).toMatchObject({ outcome: 'FAILED', reason: expect.stringContaining('Geçersiz token') });
  });

  it('dolandırıcılık incelemesi: 0 beklemede, -1 reddedildi', () => {
    expect(verdictFromRetrieve({ ...ok, fraudStatus: 0 }, expected)).toMatchObject({ outcome: 'REVIEW', fraudStatus: 0 });
    expect(verdictFromRetrieve({ ...ok, fraudStatus: -1 }, expected)).toMatchObject({ outcome: 'FAILED', fraudStatus: -1 });
  });

  it('para birimi farklıysa reddedilir', () => {
    expect(verdictFromRetrieve({ ...ok, currency: 'USD' }, expected).outcome).toBe('FAILED');
  });
});
