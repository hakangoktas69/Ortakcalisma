import { describe, expect, it } from 'vitest';
import { lineWarnings, mapPayrollHeaders, parseAmount, parsePayrollSheet } from './payroll-parser.js';
import { payrollTotals, reconcile } from './payroll.service.js';
import { makeTckn } from './test-tckn.js';

const T1 = makeTckn('123456789');
const T2 = makeTckn('234567891');

const rows = (cells: string[][]) => cells.map((c, i) => ({ n: i + 1, cells: c }));

describe('parseAmount', () => {
  it('TR, Excel ve binlik ayraçlı biçimleri okur', () => {
    expect(parseAmount('33.000,50')).toBe(33000.5);
    expect(parseAmount('33000.5')).toBe(33000.5);
    expect(parseAmount('33.000')).toBe(33000);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('₺ 4.620,00')).toBe(4620);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('-')).toBeNull();
  });
});

describe('mapPayrollHeaders', () => {
  it('işçi/işveren paylarını ve GV matrahını karıştırmaz, kümülatif ve istisna sütunlarını atlar', () => {
    const m = mapPayrollHeaders([
      'T.C. Kimlik No',
      'Adı Soyadı',
      'Prim Günü',
      'Brüt Ücret',
      'Prime Esas Kazanç',
      'SGK İşçi Payı',
      'İşsizlik İşçi Payı',
      'SGK İşveren Payı',
      'İşsizlik İşveren Payı',
      'Kümülatif GV Matrahı',
      'Gelir Vergisi Matrahı',
      'Gelir Vergisi',
      'Damga Vergisi İstisnası',
      'Damga Vergisi',
      'Net Ödenen',
    ]);
    expect(m).toEqual({
      tckn: 0,
      fullName: 1,
      days: 2,
      gross: 3,
      sgkBase: 4,
      employeeSgk: 5,
      employeeUnemployment: 6,
      employerSgk: 7,
      employerUnemployment: 8,
      incomeTaxBase: 10,
      incomeTax: 11,
      stampTax: 13,
      net: 14,
    });
  });
});

describe('parsePayrollSheet', () => {
  it('üstteki başlık satırlarını ve dipteki TOPLAM satırını atlar, hataları satır numarasıyla verir', () => {
    const r = parsePayrollSheet(
      rows([
        ['DEMİR YAZILIM LTD. ŞTİ.'],
        ['EYLÜL 2026 ÜCRET BORDROSU'],
        ['TCKN', 'Adı', 'Soyadı', 'SGK Gün', 'Brüt', 'SGK Matrahı', 'SGK İşçi', 'İşsizlik İşçi', 'Gelir Vergisi', 'Damga Vergisi', 'Net Ücret'],
        [T1, 'Ali', 'Yılmaz', '30', '33.000,00', '33.000,00', '4.620,00', '330,00', '0,00', '0,00', '28.050,00'],
        [T2, 'Ayşe', 'Kaya', '15', '20000', '20000', '2800', '200', '1.200,50', '151,80', '15.647,70'],
        ['12345678900', 'Hatalı', 'Kişi', '30', '1', '1', '0', '0', '0', '0', '1'],
        [T1, 'Ali', 'Yılmaz', '30', '1', '1', '0', '0', '0', '0', '1'],
        ['', 'TOPLAM', '', '45', '53.000,00', '53.000,00', '7.420,00', '530,00', '1.200,50', '151,80', '43.697,70'],
      ]),
    );
    expect(r.headerRow).toBe(3);
    expect(r.lines.map((l) => [l.fullName, l.days, l.sgkBase, l.incomeTax, l.net])).toEqual([
      ['Ali Yılmaz', 30, 33000, 0, 28050],
      ['Ayşe Kaya', 15, 20000, 1200.5, 15647.7],
    ]);
    expect(r.errors.map((e) => [e.row, e.message.slice(0, 20)])).toEqual([
      [6, 'Geçersiz T.C. kimlik'],
      [7, 'Aynı kişi listede ik'],
    ]);
    expect(payrollTotals(r.lines)).toMatchObject({ employeeCount: 2, totalDays: 45, sgkBase: 53000, employeeSgk: 7420, net: 43697.7, employerSgk: null, warningCount: 0 });
  });

  it('zorunlu sütun eksikse söyler, bordro olmayan tabloyu tanımaz', () => {
    expect(parsePayrollSheet(rows([['TCKN', 'Ad Soyad', 'Brüt', 'Net'], [T1, 'Ali', '1', '1']])).missingColumns).toEqual(['days', 'sgkBase']);
    expect(parsePayrollSheet(rows([['Unvan', 'VKN'], ['Firma', '1234567890']])).headerRow).toBeNull();
  });
});

describe('lineWarnings', () => {
  it('kanuni sabit oranları ve gün sınırını kontrol eder', () => {
    expect(lineWarnings({ days: 30, sgkBase: 33000, employeeSgk: 4620, employeeUnemployment: 330, gross: 33000, net: 28050 })).toEqual([]);
    const w = lineWarnings({ days: 31, sgkBase: 33000, employeeSgk: 4000, employeeUnemployment: 500, gross: 1000, net: 2000 });
    expect(w).toHaveLength(4);
    expect(w[1]).toContain('4620.00');
  });
});

describe('reconcile', () => {
  const payroll = { employeeCount: 12, totalDays: 360, sgkBase: 396000 };
  it('asıl + ek belgeleri toplar, iptali düşer', () => {
    const r = reconcile(payroll, [
      { kind: 'ASIL', insuredCount: 12, totalDays: 355, premiumBase: 390000 },
      { kind: 'EK', insuredCount: 1, totalDays: 10, premiumBase: 11000 },
      { kind: 'IPTAL', insuredCount: 1, totalDays: 5, premiumBase: 5000.5 },
    ]);
    expect(r.status).toBe('OK');
    expect(r.ebildirge).toMatchObject({ insuredCount: 12, totalDays: 360, premiumBase: 395999.5 });
  });
  it('farkları listeler; belge yoksa ayrı durum döner', () => {
    const r = reconcile(payroll, [{ kind: 'ASIL', insuredCount: 11, totalDays: 330, premiumBase: 363000 }]);
    expect(r.status).toBe('MISMATCH');
    expect(r.diffs).toHaveLength(3);
    expect(reconcile(payroll, []).status).toBe('NO_EBILDIRGE');
  });
});
