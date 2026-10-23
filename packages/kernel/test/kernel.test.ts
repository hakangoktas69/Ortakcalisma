import { describe, expect, it } from 'vitest';
import { fakeTckn, fakeVkn, seededRandom } from '@eworks/testing';
import { formatPeriod, isValidTckn, isValidVkn, maskTaxId, parsePeriod, parseTaxId } from '../src/index.ts';

describe('TaxId', () => {
  const rnd = seededRandom(42);

  it('sahte üretilen VKN ve TCKN geçerlidir', () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidVkn(fakeVkn(rnd))).toBe(true);
      expect(isValidTckn(fakeTckn(rnd))).toBe(true);
    }
  });

  it('tek hanesi değişen kimlik reddedilir', () => {
    const tckn = fakeTckn(rnd);
    const bozuk = tckn.slice(0, 10) + String((Number(tckn[10]) + 1) % 10);
    expect(parseTaxId(bozuk)).toEqual({ ok: false, error: 'gecersiz_vergi_kimligi' });
    expect(parseTaxId('12345')).toEqual({ ok: false, error: 'gecersiz_vergi_kimligi' });
    expect(isValidTckn('0' + tckn.slice(1))).toBe(false);
  });

  it('türü uzunluktan belirler ve maskeler', () => {
    const vkn = fakeVkn(rnd);
    const r = parseTaxId(` ${vkn} `);
    expect(r).toEqual({ ok: true, value: { kind: 'VKN', value: vkn } });
    if (r.ok) expect(maskTaxId(r.value)).toBe('******' + vkn.slice(-4));
    const t = parseTaxId(fakeTckn(rnd));
    expect(t.ok && t.value.kind).toBe('TCKN');
  });
});

describe('Period', () => {
  it.each(['2026-09', '2026-Q3', '2026'])('%s gidiş-dönüş', (s) => {
    const p = parsePeriod(s);
    expect(p.ok && formatPeriod(p.value)).toBe(s);
  });

  it.each(['2026-13', '2026-Q5', '26-01', ''])('%s reddedilir', (s) => {
    expect(parsePeriod(s)).toEqual({ ok: false, error: 'gecersiz_donem' });
  });
});
