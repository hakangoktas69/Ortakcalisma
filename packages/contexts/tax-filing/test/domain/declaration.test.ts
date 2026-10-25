import { describe, expect, it } from 'vitest';
import { checkQuery, istanbulDay, periodLabel, syncScope, type ContractRow, type DeclarationQuery, type DeclarationRecord } from '../../src/index.ts';

const sozlesme = (o: Partial<ContractRow> = {}): ContractRow => ({
  taxNumber: '1234567890',
  identityNumber: '',
  name: 'Örnek A.Ş.',
  taxOffice: 'Kadıköy',
  number: 'S-1',
  date: '',
  service: '',
  registeredAt: '',
  type: 'Aracılık ve Sorumluluk Sözleşmesi',
  ...o,
});
const kayit = (o: Partial<DeclarationRecord> = {}): DeclarationRecord => ({
  recordId: 'abc123',
  type: 'KDV1',
  periodStart: '2026-08',
  periodEnd: '2026-08',
  uploadedAt: '2026-09-20T23:30:00+03:00',
  taxStatus: 'Onaylandı',
  sgkStatus: '',
  branch: '0',
  reference: '1234567890_KDV1.xml',
  referenceType: 'source_filename',
  documents: [],
  documentWarnings: [],
  ...o,
});
const sorgu = (o: Partial<DeclarationQuery> = {}): DeclarationQuery => ({
  identity: '1234567890',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  outcome: 'ok',
  access: { method: 'same_session_contract', contractNumbers: ['S-1'] },
  records: [kayit()],
  ...o,
});

describe('beyanname kurum incelemesi kuralı', () => {
  it('aynı oturumdaki Aracılık ve Sorumluluk sözleşmesiyle kanıtlanan sorgu kabul edilir', () => {
    expect(checkQuery(sorgu(), [sozlesme()]).ok).toBe(true);
  });

  it('kanıt yok, sözleşme başka mükellefin ya da türü yalnız aracılık → erişim kanıtı yok', () => {
    const { access: _a, ...kanitsiz } = sorgu();
    expect(checkQuery(kanitsiz, [sozlesme()])).toEqual({ ok: false, reason: 'erisim_kaniti_yok' });
    expect(checkQuery(sorgu(), [sozlesme({ taxNumber: '2234567890' })])).toEqual({ ok: false, reason: 'erisim_kaniti_yok' });
    expect(checkQuery(sorgu(), [sozlesme({ type: 'Yalnız Aracılık Sözleşmesi' })])).toEqual({ ok: false, reason: 'erisim_kaniti_yok' });
  });

  it('fail-closed: kapsam dışı yükleme günü (İstanbul saatiyle), ters dönem, mükerrer satır', () => {
    const s = [sozlesme()];
    expect(checkQuery(sorgu({ records: [kayit({ uploadedAt: '2026-09-30T22:30:00Z' })] }), s)).toEqual({ ok: false, reason: 'kayit_gecersiz' }); // İstanbul'da 1 Ekim
    expect(checkQuery(sorgu({ records: [kayit({ periodStart: '2026-09', periodEnd: '2026-08' })] }), s)).toEqual({ ok: false, reason: 'kayit_gecersiz' });
    expect(checkQuery(sorgu({ records: [kayit(), kayit()] }), s)).toEqual({ ok: false, reason: 'kayit_gecersiz' });
    expect(istanbulDay('2026-09-30T22:30:00Z')).toBe('2026-10-01');
  });

  it('senkron kapsamı: ay aralığı gün aralığına çevrilir, bugünle sınırlanır, en çok 12 ay', () => {
    expect(syncScope('2026-08', '2026-10', '2026-10-25')).toEqual({ ok: true, startDate: '2026-08-01', endDate: '2026-10-25' });
    expect(syncScope('2025-02', '2025-02', '2026-10-25')).toEqual({ ok: true, startDate: '2025-02-01', endDate: '2025-02-28' });
    expect(syncScope('2025-01', '2026-01', '2026-10-25').ok).toBe(false);
    expect(syncScope('2026-11', '2026-11', '2026-10-25').ok).toBe(false);
    expect(syncScope('2026-09', '2026-08', '2026-10-25').ok).toBe(false);
    expect(periodLabel('2026-07', '2026-09')).toBe('07/2026–09/2026');
  });
});
