import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv.js';

describe('csvCell', () => {
  it('formül olarak çalışabilecek metinleri etkisizleştirir', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+90 532')).toBe("'+90 532");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('sayıları formül saymaz; ondalık ayıracı virgüldür', () => {
    expect(csvCell(-1250.5)).toBe('-1250,5');
    expect(csvCell(0)).toBe('0');
  });
  it('ayraç, tırnak ve satır sonu içeren metni tırnaklar', () => {
    expect(csvCell('A; B')).toBe('"A; B"');
    expect(csvCell('5" ekran')).toBe('"5"" ekran"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
  it('boş değerler', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('BOM, ; ayraç ve CRLF', () => {
    expect(toCsv(['A', 'B'], [[1, 'x']])).toBe('﻿A;B\r\n1;x\r\n');
  });
});
