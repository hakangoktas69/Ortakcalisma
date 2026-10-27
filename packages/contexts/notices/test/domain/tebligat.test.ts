import { describe, expect, it } from 'vitest';
import { noticeStatusLabel, validateNoticeList } from '../../src/index.ts';

// e-Tebligat liste kaydı (D45): yalnız liste bilgisi; belge açılmaz. Doğrulama fail-closed: tek hata listeyi reddeder.
const kayit = (i: number, o: Record<string, unknown> = {}) => ({
  noticeKey: 'a'.repeat(63) + String(i % 10),
  reference: `B-${i}`,
  documentType: 'Ödeme Emri',
  sender: 'Vergi Dairesi Başkanlığı',
  department: 'Kadıköy VD',
  sentOn: '2026-10-20',
  deliveredOn: null,
  readOn: null,
  ...o,
});
const liste = (records: unknown[], o: Record<string, unknown> = {}) => ({ count: records.length, accountVerified: true, documentsOpened: false, records, ...o });

describe('e-Tebligat listesi', () => {
  it('geçerli liste normalleştirilir', () => {
    const r = validateNoticeList(liste([kayit(1), kayit(2, { readOn: '2026-10-21', deliveredOn: '2026-10-21' })]));
    expect(r.ok && r.value.map((x) => x.reference)).toEqual(['B-1', 'B-2']);
  });

  it('fail-closed: sayı, tekrar, tarih, eksik alan, hesap doğrulanmadı ya da belge açıldı', () => {
    expect(validateNoticeList(liste([kayit(1)], { count: 2 }))).toEqual({ ok: false, error: 'sayi_uyusmuyor' });
    expect(validateNoticeList(liste([kayit(1), kayit(11)]))).toEqual({ ok: false, error: 'tekrarlanan_kayit' });
    expect(validateNoticeList(liste([kayit(1, { sentOn: '2026-13-01' })]))).toEqual({ ok: false, error: 'gecersiz_kayit' });
    expect(validateNoticeList(liste([kayit(1, { documentType: '' })]))).toEqual({ ok: false, error: 'gecersiz_kayit' });
    expect(validateNoticeList(liste([kayit(1)], { accountVerified: false }))).toEqual({ ok: false, error: 'hesap_dogrulanmadi' });
    expect(validateNoticeList(liste([kayit(1)], { documentsOpened: true }))).toEqual({ ok: false, error: 'belge_acilmis' });
  });

  it('okuma tarihi yoksa "tebliğ edilmedi" denmez', () => {
    expect(noticeStatusLabel({ readOn: null })).toBe('Okuma tarihi yok');
    expect(noticeStatusLabel({ readOn: '2026-10-21' })).toBe('Okundu (21.10.2026)');
  });
});
