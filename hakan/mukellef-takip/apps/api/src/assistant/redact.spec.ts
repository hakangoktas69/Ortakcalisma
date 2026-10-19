import { describe, expect, it } from 'vitest';
import { redactPii } from './redact.js';

describe('redactPii', () => {
  it('kimlik ve vergi numaralarını maskeler', () => {
    const r = redactPii('TCKN 12345678901 ve VKN 1234567890 olan mükellef');
    expect(r.text).toBe('TCKN [TCKN] ve VKN [VKN] olan mükellef');
    expect(r.redactions).toEqual({ tckn: 1, vkn: 1 });
  });

  it('IBAN, e-posta ve telefonu maskeler', () => {
    const r = redactPii('IBAN TR33 0006 1005 1978 6457 8413 26, mail ali.veli@ornek.com.tr, tel 0532 123 45 67 / +90 532 123 4567');
    expect(r.text).toBe('IBAN [IBAN], mail [E-POSTA], tel [TELEFON] / [TELEFON]');
    expect(r.redactions).toEqual({ iban: 1, email: 1, telefon: 2 });
  });

  it('SGK işyeri sicil numarasını parçalara bölmeden maskeler', () => {
    const r = redactPii('Sicil 2 5510 01 01 1234567 034 01 10 için');
    expect(r.text).toBe('Sicil [SİCİL NO] için');
    expect(r.redactions).toEqual({ sicil: 1 });
  });

  it('mevzuat metnine dokunmaz', () => {
    const q = '5510 sayılı Kanun 4/1-a, 2026 yılı asgari ücret 26.005,50 TL, KDV oranı %20, 213 VUK 359. madde';
    expect(redactPii(q)).toEqual({ text: q, redactions: {} });
  });
});
