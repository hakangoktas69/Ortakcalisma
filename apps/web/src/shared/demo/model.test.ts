import { describe, expect, it } from 'vitest';
import { features } from '@eworks/feature-registry';
import { demoEnabled, demoPageKeys, sampleRows, filterRows, csvDocument, pdfDocument, nextDemoId } from './model.ts';

describe('yalnız sahte veri kullanan demo sunumu', () => {
  it('yerel kayıt kimliği güvenli bağlam veya tarayıcı kripto API gerektirmez, çakışmaz', () => {
    const rows = sampleRows('notlar');
    const id = nextDemoId(rows, 'notlar');
    expect(id).toBe('demo-local-notlar-10');
    const row = rows[0];
    if (!row) throw new Error('Örnek eksik');
    expect(nextDemoId([...rows, { ...row, id }], 'notlar')).toBe('demo-local-notlar-11');
  });
  it('yalnız açık demo kipinde çalışır, bilinmeyen ve üretim kipinde kapanır', () => {
    expect(demoEnabled({ YIGIN_KIPI: 'demo', EWORKS_ORTAM: 'demo' })).toBe(true);
    for (const mode of ['uretim', 'gelistirme', 'debug', 'test', '']) {
      expect(demoEnabled({ YIGIN_KIPI: mode, EWORKS_ORTAM: 'demo' })).toBe(false);
    }
    expect(demoEnabled({ YIGIN_KIPI: 'demo', EWORKS_ORTAM: 'uretim' })).toBe(false);
    expect(demoEnabled({ YIGIN_KIPI: 'demo', EWORKS_ORTAM: 'demo', OZELLIK_DURUMU_GOSTER: 'true' })).toBe(false);
    expect(demoEnabled({})).toBe(false);
  });
  it('portaldaki her içerik sayfası örnek kayıtla açılır; satış portalını içermez', () => {
    const expected = Object.entries(features).filter(([k, f]) => f.kind === 'page' && !k.startsWith('satis.') && !k.startsWith('oturum.')).map(([k]) => k);
    expect(demoPageKeys()).toEqual(expect.arrayContaining(expected));
    for (const key of demoPageKeys()) {
      const rows = sampleRows(key);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(r => r.firm.startsWith('Demo ') && r.id.startsWith('demo-'))).toBe(true);
      expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);
    }
  });
  it('Türkçe unvan, firma, dönem ve durum birlikte süzülür; sonuç bulunamaması geçerlidir', () => {
    const rows = sampleRows('edefter.liste');
    expect(filterRows(rows, { search: 'İNŞAAT', firm: '', period: '', status: '' }).length).toBeGreaterThan(0);
    const row = rows[0];
    if (!row) throw new Error('Örnek eksik');
    expect(filterRows(rows, { search: '', firm: row.firm, period: row.period, status: row.status })).toEqual([row]);
    expect(filterRows(rows, { search: 'bulunmayan', firm: '', period: '', status: '' })).toEqual([]);
  });
  it('CSV hücreleri formül çalıştırmaz ve metinler doğru kaçırılır', () => {
    const rows = sampleRows('firmalar.liste');
    const row = rows[0];
    if (!row) throw new Error('Örnek eksik');
    const csv = csvDocument([{ ...row, title: '=HYPERLINK("x")' }]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('""x""');
    expect(csv).toContain('DEMO');
  });
  it('örnek PDF gerçek belgeyle karıştırılmayacak şekilde işaretlidir ve geçerli yapıya sahiptir', () => {
    const pdf = pdfDocument('SGK tahakkuku');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('DEMO - ORNEK BELGE');
    expect(pdf).toContain('Resmi belge degildir');
    expect(pdf).toContain('startxref');
    expect(pdf.endsWith('%%EOF')).toBe(true);
  });
});
