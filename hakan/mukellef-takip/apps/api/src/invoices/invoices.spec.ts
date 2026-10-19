import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseUblInvoice } from './ubl-parser.js';
import { buildUblInvoice } from './ubl-sample.js';
import { readInvoiceFiles } from './invoice-files.js';
import { kdvBuckets } from './invoices.service.js';

const SELLER = { taxNumber: '1234567890', name: 'Demir Yazılım Ltd. Şti.' };
const BUYER = { taxNumber: '9876543210', name: 'Kaya Gıda A.Ş.' };

const sample = (over: Partial<Parameters<typeof buildUblInvoice>[0]> = {}) =>
  buildUblInvoice({
    uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    number: 'DMR2026000000042',
    issueDate: '2026-09-15',
    supplier: SELLER,
    customer: BUYER,
    lines: [
      { name: 'Yazılım lisansı', quantity: 2, unitPrice: 1000, vatRate: 20 },
      { name: 'Kitap', quantity: 3, unitPrice: 100, vatRate: 10 },
    ],
    ...over,
  });

describe('parseUblInvoice', () => {
  it('özet, taraflar ve KDV kırılımını okur', () => {
    const r = parseUblInvoice(sample());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const inv = r.invoice;
    expect(inv).toMatchObject({
      uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      number: 'DMR2026000000042',
      issueDate: '2026-09-15',
      profile: 'TICARIFATURA',
      invoiceType: 'SATIS',
      currency: 'TRY',
      exchangeRate: 1,
      supplier: SELLER,
      customer: BUYER,
      lineExtensionAmount: 2300,
      taxExclusiveAmount: 2300,
      vatAmount: 430,
      taxInclusiveAmount: 2730,
      payableAmount: 2730,
      withholdingAmount: 0,
      lineCount: 2,
    });
    expect(inv.taxes).toEqual([
      { code: '0015', name: 'KDV', rate: 20, base: 2000, amount: 400 },
      { code: '0015', name: 'KDV', rate: 10, base: 300, amount: 30 },
    ]);
  });

  it('TCKN\'li şahıs alıcının adını Person alanından alır, baştaki sıfırları korur', () => {
    const r = parseUblInvoice(sample({ customer: { taxNumber: '01234567890', name: 'Ayşe Yılmaz' }, profile: 'EARSIVFATURA' }));
    expect(r.ok && r.invoice.customer).toEqual({ taxNumber: '01234567890', name: 'Ayşe Yılmaz' });
    expect(r.ok && r.invoice.profile).toBe('EARSIVFATURA');
  });

  it('KDV tevkifatını ayrı okur', () => {
    const r = parseUblInvoice(sample({ withholdingRatio: 0.5 }));
    expect(r.ok && r.invoice).toMatchObject({ invoiceType: 'TEVKIFAT', vatAmount: 430, withholdingAmount: 215, payableAmount: 2515 });
  });

  it('dövizli faturada kuru okur', () => {
    const r = parseUblInvoice(sample({ currency: 'EUR', exchangeRate: 37.5123 }));
    expect(r.ok && r.invoice).toMatchObject({ currency: 'EUR', exchangeRate: 37.5123 });
    const noRate = parseUblInvoice(sample({ currency: 'USD' }));
    expect(noRate.ok && noRate.invoice.exchangeRate).toBeNull();
  });

  it('fatura olmayan ve bozuk belgeleri reddeder', () => {
    expect(parseUblInvoice('<ApplicationResponse xmlns="urn:x"><ID>1</ID></ApplicationResponse>')).toEqual({ ok: false, error: 'Fatura değil (ApplicationResponse)' });
    expect(parseUblInvoice('bu bir xml değil <<<').ok).toBe(false);
    expect(parseUblInvoice(sample().replace(/<cbc:UUID>[^<]+/, '<cbc:UUID>123'))).toEqual({ ok: false, error: 'ETTN (UUID) yok veya geçersiz' });
  });

  it('DOCTYPE varlıklarını genişletmez', () => {
    const xml = sample().replace('<?xml version="1.0" encoding="UTF-8"?>', '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e "GENISLEDI">]>').replace('Demir Yazılım Ltd. Şti.', '&e;');
    const r = parseUblInvoice(xml);
    expect(r.ok && r.invoice.supplier.name).not.toBe('GENISLEDI');
  });
});

describe('readInvoiceFiles', () => {
  it('ZIP içindeki XML\'leri okur, PDF\'i sessizce, diğerlerini raporlayarak atlar', async () => {
    const zip = new JSZip();
    zip.file('2026-09/a.xml', sample());
    zip.file('2026-09/a.pdf', 'pdf');
    zip.file('ic.zip', 'zip');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const r = await readInvoiceFiles([
      { originalname: 'faturalar.zip', buffer },
      { originalname: 'tek.xml', buffer: Buffer.from(sample()) },
      { originalname: 'liste.xlsx', buffer: Buffer.from('x') },
    ]);
    expect(r.xmls.map((x) => x.name)).toEqual(['faturalar.zip/2026-09/a.xml', 'tek.xml']);
    expect(r.skipped).toEqual([
      { name: 'faturalar.zip/ic.zip', reason: 'XML değil' },
      { name: 'liste.xlsx', reason: 'Sadece .xml veya .zip yüklenebilir' },
    ]);
  });

  it('açıldığında çok büyüyen dosyayı (zip bombası) okumadan atlar', async () => {
    const zip = new JSZip();
    zip.file('bomba.xml', 'A'.repeat(8 * 1024 * 1024));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    expect(buffer.length).toBeLessThan(100_000);
    const r = await readInvoiceFiles([{ originalname: 'b.zip', buffer }]);
    expect(r.xmls).toEqual([]);
    expect(r.skipped).toEqual([{ name: 'b.zip/bomba.xml', reason: 'Dosya çok büyük' }]);
  });
});

describe('kdvBuckets', () => {
  const row = (direction: 'OUTGOING' | 'INCOMING', vat: number, extra: Partial<{ withholdingAmount: number; exchangeRate: number | null; invoiceType: string }> = {}) => ({
    direction,
    invoiceType: 'SATIS',
    exchangeRate: 1,
    taxExclusiveAmount: vat * 5,
    vatAmount: vat,
    withholdingAmount: 0,
    taxes: [{ code: '0015', rate: 20, base: vat * 5, amount: vat }],
    ...extra,
  });

  it('hesaplanan, indirilecek, KDV2 ve farkı hesaplar', () => {
    const k = kdvBuckets([
      row('OUTGOING', 1000),
      row('OUTGOING', 200, { withholdingAmount: 100, invoiceType: 'TEVKIFAT' }),
      row('INCOMING', 300, { withholdingAmount: 150 }),
      row('INCOMING', 50, { invoiceType: 'IADE' }),
      row('OUTGOING', 10, { exchangeRate: 40 }), // 400 TL KDV
      row('OUTGOING', 999, { exchangeRate: null }), // kur yok: atlanır
    ]);
    expect(k.sales).toMatchObject({ count: 3, vat: 1600, withholding: 100, base: 8000 });
    expect(k.sales.byRate).toEqual([{ rate: 20, base: 8000, vat: 1600 }]);
    expect(k.purchases).toMatchObject({ count: 2, vat: 350, withholding: 150, returns: 1 });
    expect(k.calculatedVat).toBe(1600);
    expect(k.salesWithholding).toBe(100);
    expect(k.deductibleVat).toBe(350);
    expect(k.kdv2).toBe(150);
    expect(k.difference).toBe(1150);
    expect(k.missingRate).toBe(1);
  });
});
