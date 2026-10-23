import { describe, expect, it } from 'vitest';
import { mapHeaders, norm, parsePeriod, parseTables, parseTrAmount, parseTrDateTime, parseType } from './declaration-table-parser.js';

describe('norm', () => {
  it('Türkçe karakterleri ve büyük İ/I harflerini sadeleştirir', () => {
    expect(norm('Vergi Kimlik No')).toBe('vergi kimlik no');
    expect(norm('DÖNEM')).toBe('donem');
    expect(norm('İŞLEM  DURUMU')).toBe('islem durumu');
    expect(norm('ONAY ZAMANI')).toBe('onay zamani');
  });
});

describe('mapHeaders', () => {
  it('farklı yazımlardaki başlıkları alanlara eşler', () => {
    const m = mapHeaders(['Sıra', 'Vergi Kimlik No', 'Ünvan', 'Beyanname Türü', 'Dönem', 'Durum', 'Onay Zamanı', 'Tahakkuk Tutarı']);
    expect(m).toEqual({ taxNumber: 1, type: 3, period: 4, status: 5, filedAt: 6, accrual: 7 });
  });

  it('TCKN ve kısa "Tür" başlığını tanır', () => {
    expect(mapHeaders(['TCKN', 'Tür', 'Vergilendirme Dönemi'])).toMatchObject({ taxNumber: 0, type: 1, period: 2 });
  });
});

describe('parseType', () => {
  it.each([
    ['KDV1', 'KDV1'],
    ['Katma Değer Vergisi Beyannamesi', 'KDV1'],
    ['MUHSGK', 'MUHSGK'],
    ['Muhtasar ve Prim Hizmet Beyannamesi', 'MUHSGK'],
    ['DAMGA', 'DAMGA'],
    ['GGECICI', 'GECICI_VERGI'],
    ['KGECICI', 'GECICI_VERGI'],
    ['GELIR', 'YILLIK_GELIR'],
    ['Yıllık Gelir Vergisi Beyannamesi', 'YILLIK_GELIR'],
    ['KURUMLAR', 'KURUMLAR'],
  ])('%s → %s', (raw, type) => expect(parseType(raw)).toBe(type));

  it('bilinmeyen türlerde null döner (KDV2, BA, Turizm Payı)', () => {
    expect(parseType('KDV2')).toBeNull();
    expect(parseType('BA')).toBeNull();
    expect(parseType('Turizm Payı')).toBeNull();
  });
});

describe('parsePeriod', () => {
  it('aylık biçimler', () => {
    expect(parsePeriod('09/2026', 'KDV1')).toBe('2026-09');
    expect(parsePeriod('2026/09', 'KDV1')).toBe('2026-09');
    expect(parsePeriod('Eylül 2026', 'MUHSGK')).toBe('2026-09');
    expect(parsePeriod('EYLÜL/2026', 'MUHSGK')).toBe('2026-09');
    expect(parsePeriod('09/2026-09/2026', 'DAMGA')).toBe('2026-09');
    expect(parsePeriod('01.09.2026-30.09.2026', 'KDV1')).toBe('2026-09');
  });

  it('geçici vergi çeyrekleri; 4. dönem yoktur', () => {
    expect(parsePeriod('07/2026-09/2026', 'GECICI_VERGI')).toBe('2026-Q3');
    expect(parsePeriod('01.01.2026-31.03.2026', 'GECICI_VERGI')).toBe('2026-Q1');
    expect(parsePeriod('2026/2. Dönem', 'GECICI_VERGI')).toBe('2026-Q2');
    expect(parsePeriod('10/2026-12/2026', 'GECICI_VERGI')).toBeNull();
    expect(parsePeriod('09/2026', 'GECICI_VERGI')).toBeNull();
  });

  it('yıllık beyannameler', () => {
    expect(parsePeriod('2025', 'KURUMLAR')).toBe('2025');
    expect(parsePeriod('01/2025-12/2025', 'YILLIK_GELIR')).toBe('2025');
    expect(parsePeriod('09/2025', 'KURUMLAR')).toBeNull();
  });

  it('aylık beyanda birden fazla ay kapsayan aralık reddedilir', () => {
    expect(parsePeriod('07/2026-09/2026', 'KDV1')).toBeNull();
  });
});

describe('tarih ve tutar', () => {
  it('Türkçe tarih/saat', () => {
    expect(parseTrDateTime('28.10.2026 14:35:12')).toEqual(new Date(2026, 9, 28, 14, 35, 12));
    expect(parseTrDateTime('28.10.2026')).toEqual(new Date(2026, 9, 28, 12, 0, 0));
    expect(parseTrDateTime('')).toBeNull();
  });

  it('Türkçe tutar', () => {
    expect(parseTrAmount('12.345,67')).toBe(12345.67);
    expect(parseTrAmount('1.250,00 TL')).toBe(1250);
    expect(parseTrAmount('980.5')).toBe(980.5);
    expect(parseTrAmount('')).toBeNull();
  });
});

describe('parseTables', () => {
  const headers = ['Vergi Kimlik No', 'Ünvan', 'Beyanname Türü', 'Dönem', 'Durum', 'Onay Zamanı', 'Tahakkuk Tutarı'];

  it('onaylı satırları alır, onaylanmamışları atlar ve sayar', () => {
    const r = parseTables([
      {
        headers,
        rows: [
          ['1000190056', 'Çelik Gıda', 'KDV1', '09/2026', 'Onaylandı', '20.10.2026 10:00:00', '12.345,67'],
          ['1000190056', 'Çelik Gıda', 'MUHSGK', '09/2026', 'Hatalı', '20.10.2026 10:05:00', ''],
          ['10000418916', 'Ali Demir', 'GGECICI', '07/2026-09/2026', 'Onaylandı', '15.11.2026 09:00:00', '4.500,00'],
        ],
      },
    ]);
    expect(r.tablesUsed).toBe(1);
    expect(r.skippedNotApproved).toBe(1);
    expect(r.declarations).toHaveLength(2);
    expect(r.declarations[0]).toMatchObject({ taxNumber: '1000190056', type: 'KDV1', period: '2026-09', accrualAmount: 12345.67 });
    expect(r.declarations[1]).toMatchObject({ taxNumber: '10000418916', type: 'GECICI_VERGI', period: '2026-Q3' });
  });

  it('tanınmayan tür ve dönemleri raporlar, sessizce atlamaz', () => {
    const r = parseTables([
      {
        headers,
        rows: [
          ['1000190056', 'X', 'KDV2', '09/2026', 'Onaylandı', '', ''],
          ['1000190056', 'X', 'KDV1', 'bilinmeyen', 'Onaylandı', '', ''],
        ],
      },
    ]);
    expect(r.declarations).toHaveLength(0);
    expect(r.unknownTypes).toEqual(['KDV2']);
    expect(r.unknownPeriods).toEqual(['KDV1: bilinmeyen']);
  });

  it('beyanname tablosu olmayan tabloları yok sayar ama başlıklarını raporlar', () => {
    const r = parseTables([{ headers: ['Menü', 'Bağlantı'], rows: [['a', 'b']] }]);
    expect(r.tablesUsed).toBe(0);
    expect(r.ignoredTableHeaders).toEqual([['Menü', 'Bağlantı']]);
  });

  it('geçersiz VKN satırlarını ve aynı sayfadaki tekrarları atlar', () => {
    const r = parseTables([
      {
        headers,
        rows: [
          ['Toplam', '', '', '', '', '', ''],
          ['1000190056', 'X', 'KDV1', '09/2026', 'Onaylandı', '', ''],
          ['1000190056', 'X', 'KDV1', '09/2026', 'Onaylandı', '', ''],
        ],
      },
    ]);
    expect(r.declarations).toHaveLength(1);
  });
});
