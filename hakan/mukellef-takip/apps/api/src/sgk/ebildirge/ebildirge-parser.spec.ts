import { describe, expect, it } from 'vitest';
import { mapBildirgeHeaders, parseBildirgePeriod, parseBildirgeTables, parseKind, registryDigits, sameRegistry } from './ebildirge-parser.js';

describe('parseBildirgePeriod', () => {
  it.each([
    ['2026/09', '2026-09'],
    ['09/2026', '2026-09'],
    ['2026-9', '2026-09'],
    ['202609', '2026-09'],
    ['Eylül 2026', '2026-09'],
    ['EYLÜL/2026', '2026-09'],
  ])('%s → %s', (raw, p) => expect(parseBildirgePeriod(raw)).toBe(p));
  it('geçersizler', () => {
    expect(parseBildirgePeriod('2026/13')).toBeNull();
    expect(parseBildirgePeriod('abc')).toBeNull();
  });
});

describe('parseKind', () => {
  it('asıl / ek / iptal', () => {
    expect(parseKind('Asıl')).toBe('ASIL');
    expect(parseKind('EK')).toBe('EK');
    expect(parseKind('Ek Belge')).toBe('EK');
    expect(parseKind('İptal')).toBe('IPTAL');
    expect(parseKind('')).toBe('ASIL');
  });
});

describe('sicil', () => {
  it('rakamları çıkarır, kısa numaraları sicil saymaz', () => {
    expect(registryDigits('2 5510 01 01 1000037 034 01 10')).toBe('25510010110000370340110');
    expect(registryDigits('12345')).toBeNull();
  });
  it('aracı numarası farkını tolere eder', () => {
    expect(sameRegistry('2 5510 01 01 1000037 034 01 10', '25510010110000370340110000')).toBe(true);
    expect(sameRegistry('2 5510 01 01 1000037 034 01 10', '2 5510 01 01 1000038 034 01 10')).toBe(false);
  });
});

describe('mapBildirgeHeaders', () => {
  it('prime esas kazanç ile prim tutarını karıştırmaz', () => {
    const m = mapBildirgeHeaders(['Dönem', 'Belge Türü', 'Kanun No', 'Mahiyet', 'Sigortalı Sayısı', 'Prim Ödeme Gün Sayısı', 'Prime Esas Kazanç', 'Prim Tutarı', 'Onay Tarihi']);
    expect(m).toEqual({ period: 0, documentType: 1, lawNo: 2, kind: 3, insuredCount: 4, totalDays: 5, premiumBase: 6, accrual: 7, approvedAt: 8 });
  });
  it('"PEK Tutarı" prime esas kazançtır, tahakkuk değil', () => {
    expect(mapBildirgeHeaders(['Dönem', 'Belge Türü', 'PEK Tutarı', 'Tahakkuk Tutarı', 'Sigortalı Sayısı'])).toMatchObject({ premiumBase: 2, accrual: 3 });
  });
  it('ayrı yıl ve ay sütunları', () => {
    expect(mapBildirgeHeaders(['Yıl', 'Ay', 'Belge Türü', 'Kişi'])).toMatchObject({ year: 0, month: 1, documentType: 2, insuredCount: 3 });
  });
});

describe('parseBildirgeTables', () => {
  it('belgeleri okur, kodları normalleştirir', () => {
    const r = parseBildirgeTables([
      {
        headers: ['Dönem', 'Belge Türü', 'Kanun No', 'Mahiyet', 'Sigortalı Sayısı', 'Prim Ödeme Gün Sayısı', 'Prime Esas Kazanç', 'Prim Tutarı', 'Onay Tarihi'],
        rows: [
          ['2026/09', '1', '5510', 'Asıl', '12', '360', '312.500,00', '117.187,50', '20.10.2026 14:00'],
          ['2026/09', '1', '5510', 'Ek', '1', '30', '26.000,00', '9.750,00', '22.10.2026'],
          ['Toplam', '', '', '', '13', '390', '', '', ''],
        ],
      },
    ]);
    expect(r.tablesUsed).toBe(1);
    expect(r.documents).toHaveLength(2);
    expect(r.documents[0]).toMatchObject({ period: '2026-09', documentType: '01', lawNo: '05510', kind: 'ASIL', insuredCount: 12, totalDays: 360, premiumBase: 312500, accrualAmount: 117187.5 });
    expect(r.documents[1].kind).toBe('EK');
    expect(r.unreadablePeriods).toEqual(['Toplam']);
  });

  it('ayrı yıl/ay sütunlu tablo', () => {
    const r = parseBildirgeTables([{ headers: ['Yıl', 'Ay', 'Belge Türü', 'Kanun', 'Kişi Sayısı'], rows: [['2026', '8', '01', '00000', '9']] }]);
    expect(r.documents[0]).toMatchObject({ period: '2026-08', lawNo: '00000', insuredCount: 9 });
  });

  it('beyanname veya tebligat tablosunu bildirge saymaz', () => {
    expect(parseBildirgeTables([{ headers: ['Vergi Kimlik No', 'Beyanname Türü', 'Dönem', 'Onay Zamanı'], rows: [['1', 'KDV1', '09/2026', '']] }]).tablesUsed).toBe(0);
    expect(parseBildirgeTables([{ headers: ['Gönderen', 'Konu', 'Tarih'], rows: [['GİB', 'X', '01.10.2026']] }]).tablesUsed).toBe(0);
  });
});
