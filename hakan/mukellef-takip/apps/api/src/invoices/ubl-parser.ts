import { XMLParser } from 'fast-xml-parser';

/**
 * UBL-TR 1.2 fatura (e-Fatura ve e-Arşiv) ayrıştırıcı. Entegratörlerin dışa aktardığı XML'ler bu
 * standarttadır; entegratörden bağımsız çalışır. Sadece özet ve vergi bilgileri okunur, satır detayı saklanmaz.
 */

export interface InvoiceTax {
  code: string; // 0015 KDV, 0071 ÖTV (I), 4080 ÖİV, 9015 KDV tevkifatı…
  name: string;
  rate: number | null;
  base: number;
  amount: number;
}

export interface ParsedInvoice {
  uuid: string;
  number: string;
  issueDate: string; // YYYY-MM-DD
  profile: string;
  invoiceType: string;
  currency: string;
  exchangeRate: number | null;
  supplier: { taxNumber: string | null; name: string | null };
  customer: { taxNumber: string | null; name: string | null };
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxInclusiveAmount: number;
  payableAmount: number;
  vatAmount: number;
  withholdingAmount: number;
  taxes: InvoiceTax[];
  lineCount: number;
}

export type UblResult = { ok: true; invoice: ParsedInvoice } | { ok: false; error: string };

const ARRAYS = new Set(['TaxTotal', 'TaxSubtotal', 'WithholdingTaxTotal', 'InvoiceLine', 'PartyIdentification']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false, // VKN, fatura no ve tutarlar metin olarak kalsın (baştaki sıfırlar, yuvarlama)
  parseAttributeValue: false,
  processEntities: false, // DOCTYPE/varlık genişletme yok
  isArray: (name) => ARRAYS.has(name),
});

type Node = Record<string, unknown> | string | undefined;

function text(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as object)) return String((v as Record<string, unknown>)['#text']).trim();
  return '';
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : v ? [obj(v)] : []);
const round2 = (n: number) => Math.round(n * 100) / 100;

function amount(v: unknown): number {
  const s = text(v);
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`Geçersiz tutar: ${s.slice(0, 30)}`);
  return round2(n);
}

function party(p: Node) {
  const partyNode = obj(obj(p).Party);
  const ids = list(partyNode.PartyIdentification).map((pi) => obj(pi).ID);
  let taxNumber: string | null = null;
  for (const id of ids) {
    const scheme = String(obj(id)['@_schemeID'] ?? '').toUpperCase();
    if (scheme === 'VKN' || scheme === 'TCKN') {
      taxNumber = text(id).replace(/\D/g, '') || null;
      break;
    }
  }
  const person = obj(partyNode.Person);
  const personName = [text(person.FirstName), text(person.FamilyName)].filter(Boolean).join(' ');
  const name = text(obj(partyNode.PartyName).Name) || personName || null;
  return { taxNumber, name };
}

export function parseUblInvoice(xml: string): UblResult {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, error: 'XML okunamadı' };
  }
  const root = Object.keys(doc).find((k) => k !== '?xml' && !k.startsWith('?'));
  if (root !== 'Invoice') return { ok: false, error: root ? `Fatura değil (${root})` : 'Boş dosya' };
  const inv = obj(doc.Invoice);

  try {
    const uuid = text(inv.UUID).toLowerCase();
    const number = text(inv.ID);
    const issueDate = text(inv.IssueDate);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) return { ok: false, error: 'ETTN (UUID) yok veya geçersiz' };
    if (!number) return { ok: false, error: 'Fatura numarası yok' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || Number.isNaN(Date.parse(issueDate))) return { ok: false, error: 'Düzenleme tarihi geçersiz' };

    const taxes: InvoiceTax[] = [];
    for (const total of list(inv.TaxTotal)) {
      for (const sub of list(total.TaxSubtotal)) {
        const scheme = obj(obj(sub.TaxCategory).TaxScheme);
        const rate = text(sub.Percent);
        taxes.push({
          code: text(scheme.TaxTypeCode),
          name: text(scheme.Name),
          rate: rate === '' ? null : Number(rate),
          base: amount(sub.TaxableAmount),
          amount: amount(sub.TaxAmount),
        });
      }
    }
    const withholdingAmount = round2(list(inv.WithholdingTaxTotal).reduce((s, w) => s + amount(w.TaxAmount), 0));
    const totals = obj(inv.LegalMonetaryTotal);
    const currency = (text(inv.DocumentCurrencyCode) || 'TRY').toUpperCase();
    const rate = Number(text(obj(inv.PricingExchangeRate).CalculationRate));

    return {
      ok: true,
      invoice: {
        uuid,
        number,
        issueDate,
        profile: text(inv.ProfileID).toUpperCase(),
        invoiceType: text(inv.InvoiceTypeCode).toUpperCase(),
        currency,
        exchangeRate: currency === 'TRY' ? 1 : Number.isFinite(rate) && rate > 0 ? rate : null,
        supplier: party(inv.AccountingSupplierParty as Node),
        customer: party(inv.AccountingCustomerParty as Node),
        lineExtensionAmount: amount(totals.LineExtensionAmount),
        taxExclusiveAmount: amount(totals.TaxExclusiveAmount),
        taxInclusiveAmount: amount(totals.TaxInclusiveAmount),
        payableAmount: amount(totals.PayableAmount),
        vatAmount: round2(taxes.filter((t) => t.code === '0015').reduce((s, t) => s + t.amount, 0)),
        withholdingAmount,
        taxes,
        lineCount: list(inv.InvoiceLine).length,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Fatura okunamadı' };
  }
}
