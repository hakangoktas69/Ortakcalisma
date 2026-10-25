import { describe, expect, it } from 'vitest';
import { extendExpiry, priceFor } from './plans.js';

describe('priceFor', () => {
  it('indirimli dönemler', () => {
    expect(priceFor('pro', 1)?.amount).toBe(1500);
    expect(priceFor('pro', 6)?.amount).toBe(8550); // 9000 * 0.95
    expect(priceFor('pro', 12)?.amount).toBe(15300); // 18000 * 0.85
  });
  it('bilinmeyen paket veya dönem', () => {
    expect(priceFor('yok', 1)).toBeNull();
    expect(priceFor('pro', 3)).toBeNull();
  });
});

describe('extendExpiry', () => {
  const now = new Date(2026, 9, 12);
  it('bitmemiş lisansın üzerine ekler', () => {
    expect(extendExpiry(new Date(2026, 11, 1), 1, now)).toEqual(new Date(2027, 0, 1));
  });
  it('bitmiş lisansta bugünden başlar', () => {
    expect(extendExpiry(new Date(2026, 0, 1), 12, now)).toEqual(new Date(2027, 9, 12));
    expect(extendExpiry(null, 1, now)).toEqual(new Date(2026, 10, 12));
  });
  it('ay sonu taşmasını önler (31 Ocak + 1 ay = 28 Şubat)', () => {
    expect(extendExpiry(new Date(2027, 0, 31), 1, now)).toEqual(new Date(2027, 1, 28));
  });
});
