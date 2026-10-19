/**
 * Testler ve demo için UBL-TR 1.2 fatura XML'i üretir (entegratörlerin dışa aktardığı biçimle aynı yapı).
 * Gerçek bir fatura değildir; GİB'e gönderilemez (imza ve şema doğrulama alanları yok).
 */
export interface SampleLine {
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface SampleInvoice {
  uuid: string;
  number: string;
  issueDate: string;
  profile?: string;
  type?: string;
  currency?: string;
  exchangeRate?: number;
  supplier: { taxNumber: string; name: string };
  customer: { taxNumber: string; name: string };
  lines: SampleLine[];
  /** KDV tevkifat oranı (ör. 0.5 = 5/10) */
  withholdingRatio?: number;
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
const f2 = (n: number) => n.toFixed(2);

function partyXml(tag: string, p: { taxNumber: string; name: string }) {
  const scheme = p.taxNumber.length === 11 ? 'TCKN' : 'VKN';
  const nameXml =
    scheme === 'TCKN'
      ? `<cac:Person><cbc:FirstName>${esc(p.name.split(' ')[0])}</cbc:FirstName><cbc:FamilyName>${esc(p.name.split(' ').slice(1).join(' '))}</cbc:FamilyName></cac:Person>`
      : `<cac:PartyName><cbc:Name>${esc(p.name)}</cbc:Name></cac:PartyName>`;
  return `<cac:${tag}><cac:Party><cac:PartyIdentification><cbc:ID schemeID="${scheme}">${p.taxNumber}</cbc:ID></cac:PartyIdentification>${nameXml}<cac:PostalAddress><cbc:CityName>İstanbul</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress></cac:Party></cac:${tag}>`;
}

export function buildUblInvoice(s: SampleInvoice): string {
  const cur = s.currency ?? 'TRY';
  const lines = s.lines.map((l) => ({ ...l, ext: Math.round(l.quantity * l.unitPrice * 100) / 100 }));
  const byRate = new Map<number, { base: number; vat: number }>();
  for (const l of lines) {
    const g = byRate.get(l.vatRate) ?? { base: 0, vat: 0 };
    g.base += l.ext;
    g.vat += Math.round(l.ext * l.vatRate) / 100;
    byRate.set(l.vatRate, g);
  }
  const base = lines.reduce((a, l) => a + l.ext, 0);
  const vat = [...byRate.values()].reduce((a, g) => a + g.vat, 0);
  const withheld = s.withholdingRatio ? Math.round(vat * s.withholdingRatio * 100) / 100 : 0;
  const amt = (n: number) => `currencyID="${cur}">${f2(n)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>${s.profile ?? 'TICARIFATURA'}</cbc:ProfileID>
  <cbc:ID>${esc(s.number)}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${s.uuid.toUpperCase()}</cbc:UUID>
  <cbc:IssueDate>${s.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>10:15:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${s.type ?? (withheld ? 'TEVKIFAT' : 'SATIS')}</cbc:InvoiceTypeCode>
  <cbc:Note>Demo fatura</cbc:Note>
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${lines.length}</cbc:LineCountNumeric>
  ${partyXml('AccountingSupplierParty', s.supplier)}
  ${partyXml('AccountingCustomerParty', s.customer)}
  ${cur !== 'TRY' && s.exchangeRate ? `<cac:PricingExchangeRate><cbc:SourceCurrencyCode>${cur}</cbc:SourceCurrencyCode><cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode><cbc:CalculationRate>${s.exchangeRate}</cbc:CalculationRate></cac:PricingExchangeRate>` : ''}
  <cac:TaxTotal>
    <cbc:TaxAmount ${amt(vat)}</cbc:TaxAmount>
    ${[...byRate.entries()]
      .map(
        ([rate, g]) =>
          `<cac:TaxSubtotal><cbc:TaxableAmount ${amt(g.base)}</cbc:TaxableAmount><cbc:TaxAmount ${amt(g.vat)}</cbc:TaxAmount><cbc:Percent>${rate}</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`,
      )
      .join('\n    ')}
  </cac:TaxTotal>
  ${
    withheld
      ? `<cac:WithholdingTaxTotal><cbc:TaxAmount ${amt(withheld)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount ${amt(vat)}</cbc:TaxableAmount><cbc:TaxAmount ${amt(withheld)}</cbc:TaxAmount><cbc:Percent>${s.withholdingRatio! * 100}</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV TEVKİFAT</cbc:Name><cbc:TaxTypeCode>620</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:WithholdingTaxTotal>`
      : ''
  }
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount ${amt(base)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount ${amt(base)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount ${amt(base + vat)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount ${amt(base + vat - withheld)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lines
    .map(
      (l, i) =>
        `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="C62">${l.quantity}</cbc:InvoicedQuantity><cbc:LineExtensionAmount ${amt(l.ext)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${esc(l.name)}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount ${amt(l.unitPrice)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`,
    )
    .join('\n  ')}
</Invoice>`;
}
