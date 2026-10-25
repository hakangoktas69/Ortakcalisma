import { describe, expect, it } from 'vitest';
import { buildTemplate, isValidTckn, mapHeaders, parseCompanyType, readSheet, toImportRows, validateRow } from './company-import.js';

describe('isValidTckn', () => {
  it('geçerli ve geçersiz', () => {
    expect(isValidTckn('10000000146')).toBe(true);
    expect(isValidTckn('10000000147')).toBe(false);
    expect(isValidTckn('00000000146')).toBe(false);
    expect(isValidTckn('1000000014')).toBe(false);
  });
});

describe('parseCompanyType', () => {
  it.each([
    ['Şirket', 'SIRKET'],
    ['LTD', 'SIRKET'],
    ['Anonim', 'SIRKET'],
    ['şahıs', 'SAHIS'],
    ['Serbest meslek', 'SAHIS'],
    ['Basit Usul', 'BASIT_USUL'],
    ['', null],
    ['bilinmez', null],
  ])('%s → %s', (raw, t) => expect(parseCompanyType(raw)).toBe(t));
});

describe('mapHeaders', () => {
  it('farklı yazımlar', () => {
    expect(mapHeaders(['Firma Adı', 'Vergi No', 'Mükellefiyet Türü', 'V.D.', 'GSM', 'Mail'])).toMatchObject({ title: 0, taxNumber: 1, type: 2, phone: 4, email: 5 });
    expect(mapHeaders(['Unvan / Ad Soyad', 'VKN / TCKN', 'Tür', 'Vergi Dairesi'])).toEqual({ title: 0, taxNumber: 1, type: 2, taxOffice: 3 });
  });
});

describe('validateRow', () => {
  it('eksik unvan ve hatalı numara hata; tür boşsa uzunluktan tahmin uyarı', () => {
    expect(validateRow(2, { title: '', taxNumber: '123' }).errors).toEqual(['Unvan boş', 'VKN 10, TCKN 11 haneli olmalı']);
    expect(validateRow(2, { title: 'X', taxNumber: '1234567890' }).errors).toEqual(['Unvan çok kısa']);
    const r = validateRow(3, { title: 'X Ltd', taxNumber: '1234567890' });
    expect(r.type).toBe('SIRKET');
    expect(r.warnings[0]).toMatch(/varsayıldı/);
  });
  it('anlaşılamayan tür ve geçersiz e-posta hata', () => {
    const r = validateRow(2, { title: 'X', taxNumber: '1234567890', type: 'kooperatifimsi', email: 'a@' });
    expect(r.errors).toEqual(expect.arrayContaining([expect.stringMatching(/Tür anlaşılamadı/), 'E-posta geçersiz']));
  });
  it('numaradaki boşluk ve tireleri temizler', () => {
    expect(validateRow(2, { title: 'X', taxNumber: '123 456-7890' }).taxNumber).toBe('1234567890');
  });
});

describe('dosya okuma', () => {
  it('şablon kendi kendini okuyabilir (xlsx gidiş-dönüş)', async () => {
    const sheet = await readSheet(await buildTemplate(), 'sablon.xlsx');
    const { error, rows } = toImportRows(sheet);
    expect(error).toBeNull();
    expect(rows.map((r) => [r.taxNumber, r.type, r.errors.length])).toEqual([
      ['1234567890', 'SIRKET', 0],
      ['10000000146', 'SAHIS', 0],
    ]);
  });

  it('CSV: ; ayraç, BOM, tırnaklı alan, boş satır, dosya içi tekrar', async () => {
    const csv = '\uFEFFUnvan;VKN;Tür\r\n"A; B Ltd";1234567890;Şirket\r\n\r\nC Ltd;1234567890;Şirket\r\n';
    const { rows } = toImportRows(await readSheet(Buffer.from(csv), 'f.csv'));
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('A; B Ltd');
    expect(rows[1].row).toBe(4);
    expect(rows[1].errors[0]).toMatch(/2\. satırda da var/);
  });

  it('zorunlu sütun yoksa açık hata', async () => {
    const { error } = toImportRows(await readSheet(Buffer.from('Ad;Telefon\nx;1\n'), 'f.csv'));
    expect(error).toMatch(/Unvan.*VKN/);
  });
});
