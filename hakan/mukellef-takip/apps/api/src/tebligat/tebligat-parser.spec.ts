import { describe, expect, it } from 'vitest';
import { deemedServedDate, mapTebligatHeaders, parseTebligatTables } from './tebligat-parser.js';

describe('deemedServedDate (VUK 107/A)', () => {
  it('ulaşmayı izleyen 5. günün sonu', () => {
    expect(deemedServedDate(new Date(2026, 9, 1, 14, 30))).toEqual(new Date(2026, 9, 6, 23, 59, 59));
  });
  it('ay ve yıl sonunu doğru geçer', () => {
    expect(deemedServedDate(new Date(2026, 9, 29))).toEqual(new Date(2026, 10, 3, 23, 59, 59));
    expect(deemedServedDate(new Date(2026, 11, 30))).toEqual(new Date(2027, 0, 4, 23, 59, 59));
  });
});

describe('mapTebligatHeaders', () => {
  it('yaygın başlıkları eşler; okunma tarihi gönderim tarihine karışmaz', () => {
    expect(mapTebligatHeaders(['Belge No', 'Gönderen Birim', 'Konu', 'Gönderim Tarihi', 'Okunma Tarihi'])).toEqual({
      documentNo: 0,
      sender: 1,
      subject: 2,
      deliveredAt: 3,
      readAt: 4,
    });
  });
});

describe('parseTebligatTables', () => {
  const headers = ['Vergi Kimlik No', 'Belge No', 'Gönderen Birim', 'Belge Türü', 'Gönderim Tarihi', 'Okunma Tarihi'];

  it('VKN sütunlu tabloyu okur, tebliğ tarihini hesaplar', () => {
    const r = parseTebligatTables([
      {
        headers,
        rows: [
          ['1000190056', 'EVR-1', 'Kadıköy Vergi Dairesi Müdürlüğü', 'Vergi/Ceza İhbarnamesi', '01.10.2026 10:15:00', ''],
          ['1000190056', 'EVR-2', 'Gelir İdaresi Başkanlığı', 'Bilgi İsteme Yazısı', '02.10.2026', '03.10.2026 09:00:00'],
        ],
      },
    ]);
    expect(r.tablesUsed).toBe(1);
    expect(r.missingTaxNumberColumn).toBe(false);
    expect(r.tebligats).toHaveLength(2);
    expect(r.tebligats[0]).toMatchObject({
      taxNumber: '1000190056',
      documentNo: 'EVR-1',
      subject: 'Vergi/Ceza İhbarnamesi',
      deemedServedAt: new Date(2026, 9, 6, 23, 59, 59),
      readAtGib: null,
    });
    expect(r.tebligats[1].readAtGib).toEqual(new Date(2026, 9, 3, 9, 0, 0));
  });

  it('VKN sütunu yoksa bunu bildirir; belge no yoksa kararlı anahtar türetir', () => {
    const t = { headers: ['Gönderen', 'Konu', 'Tarih'], rows: [['GİB', 'Yoklama Fişi', '05.10.2026']] };
    const a = parseTebligatTables([t]);
    const b = parseTebligatTables([t]);
    expect(a.missingTaxNumberColumn).toBe(true);
    expect(a.tebligats[0]).toMatchObject({ taxNumber: null, documentNoDerived: true });
    expect(a.tebligats[0].documentNo).toBe(b.tebligats[0].documentNo);
    expect(a.tebligats[0].documentNo).toMatch(/^T-[0-9a-f]{16}$/);
  });

  it('beyanname tablosunu tebligat saymaz', () => {
    const r = parseTebligatTables([
      { headers: ['Vergi Kimlik No', 'Beyanname Türü', 'Dönem', 'Onay Zamanı'], rows: [['1000190056', 'KDV1', '09/2026', '20.10.2026']] },
    ]);
    expect(r.tablesUsed).toBe(0);
  });

  it('tarihi okunamayan satırları sayar, boş satırları saymaz', () => {
    const r = parseTebligatTables([{ headers, rows: [['1000190056', 'X', 'GİB', 'Konu', 'geçersiz', ''], ['', '', '', '', '', '']] }]);
    expect(r.tebligats).toHaveLength(0);
    expect(r.unreadableDates).toBe(1);
  });
});
