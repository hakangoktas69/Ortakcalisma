import { demoFirms, type Firm } from './details.ts';

export type PortfolioFirm = Firm & { legalType: string; representative: string; group: string; luca: string; revenue: string; gibUser: string; sgkUser: string; workplace: string; uetsAddress: string; portalUser: string; gibIssue: string; sgkIssue: string; twoFactor: string; archived: string; usePermission: string; consent: string };
export const portfolioFirms: PortfolioFirm[] = demoFirms.map((f, i) => ({ ...f, archived: 'Hayır', usePermission: 'Verilmedi', consent: 'Alınmadı', legalType: ['Limited', 'Anonim', 'Şahıs'][i] ?? 'Şahıs', representative: 'Demo Yetkili', group: i === 2 ? 'Demo şahıslar' : 'Demo kurumlar', luca: `DEMO-LUCA-${i + 1}`, revenue: ['1250000', '860000', ''][i] ?? '', gibUser: i === 2 ? '' : `DEMO-GIB-${i + 1}`, sgkUser: i === 2 ? '' : `DEMO-SGK-${i + 1}`, workplace: i === 2 ? '' : `DEMO-ISYERI-${i + 1}`, uetsAddress: '', portalUser: '', gibIssue: i === 2 ? 'missing' : '', sgkIssue: i === 1 ? 'wrong' : i === 2 ? 'missing' : '', twoFactor: i === 0 ? 'Evet' : 'Hayır' }));
export type PortfolioFilters = { search: string; type: string; staff: string; state: string; segment: string; quick: string };
export const emptyPortfolioFilters: PortfolioFilters = { search: '', type: '', staff: '', state: '', segment: 'all', quick: '' };
export const portfolioSearchKey = (value: string) => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim();
export function portfolioQuickMatch(f: PortfolioFirm, key: string): boolean {
  if (key === 'twoFactor') return f.twoFactor === 'Evet';
  if (key === 'gibWrong') return f.gibIssue === 'wrong';
  if (key === 'gibMissing') return !f.gibUser || f.gibIssue === 'missing';
  if (key === 'sgkWrong') return f.sgkIssue === 'wrong';
  if (key === 'sgkMissing') return !f.sgkUser || !f.workplace || f.sgkIssue === 'missing';
  if (key === 'invoice') return f.invoice === 'Aktif';
  if (key === 'dispatch') return f.dispatch === 'Aktif';
  if (key === 'ledger') return f.ledger === 'Aktif';
  return true;
}
export function portfolioSegmentMatch(f: PortfolioFirm, segment: string): boolean {
  if (segment === 'approved') return f.state === 'Onaylanmış';
  if (segment === 'pending') return f.state !== 'Onaylanmış';
  if (segment === 'simple') return f.regime === 'Basit Usul';
  if (segment === 'corporate') return f.type === 'Kurum';
  if (segment === 'personal') return f.type === 'Şahıs';
  return true;
}
export function portfolioFilter(firms: PortfolioFirm[], filters: PortfolioFilters): PortfolioFirm[] {
  const q = portfolioSearchKey(filters.search); const words = q.split(' ');
  const rank = (f: PortfolioFirm) => { const name = portfolioSearchKey(f.name); return name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : 3; };
  return firms.filter(f => words.every(w => portfolioSearchKey(Object.values(f).join(' ')).includes(w)) && (!filters.type || f.type === filters.type || f.regime === filters.type) && (!filters.staff || f.staff === filters.staff) && (filters.state === 'Arşivde' ? f.archived === 'Evet' : f.archived !== 'Evet' && (!filters.state || f.state === filters.state)) && portfolioSegmentMatch(f, filters.segment) && portfolioQuickMatch(f, filters.quick)).sort((a, b) => q ? rank(a) - rank(b) : 0);
}
export const toggleVisibleFirms = (selected: string[], visible: string[]) => visible.every(id => selected.includes(id)) ? selected.filter(id => !visible.includes(id)) : [...new Set([...selected, ...visible])];
export const approvePortfolio = (firms: PortfolioFirm[], selected: string[]) => firms.map(f => selected.includes(f.id) && f.archived !== 'Evet' ? { ...f, state: 'Onaylanmış' } : f);
export function portfolioProblem(f: PortfolioFirm, firms: PortfolioFirm[]): string | null {
  if (!f.name.startsWith('Demo ') || f.name.length > 160) return 'Unvan Demo ile başlamalı ve en fazla 160 karakter olmalı.';
  if (!/^DEMO-\*{3}\d+$/.test(f.identity)) return 'Kimlik alanında DEMO-***1 gibi maskeli örnek kimlik kullanın.';
  if (!/^[^\s@]+@example\.test$/.test(f.email)) return 'Yalnız @example.test uzantılı örnek e-posta kullanın.';
  if (firms.some(other => other.id !== f.id && other.identity === f.identity)) return 'Bu maskeli örnek kimlik başka firmada kullanılıyor.';
  if (f.revenue !== '' && (!Number.isFinite(Number(f.revenue)) || Number(f.revenue) < 0)) return 'Hasılat sıfır veya pozitif sayı olmalı.';
  if (!['Limited', 'Anonim', 'Şahıs', 'Esnaf', 'Serbest Meslek'].includes(f.legalType)) return 'Listeden bir firma türü seçin.';
  for (const value of [f.gibUser, f.sgkUser, f.workplace, f.uetsAddress, f.portalUser]) if (value && !value.startsWith('DEMO-')) return 'Kurum kullanıcılarında yalnız DEMO- ile başlayan örnek bilgi kullanın.';
  return null;
}
export function portfolioCsv(firms: PortfolioFirm[]): string {
  const cell = (s: string) => `"${(/^[\s]*[=+\-@]/.test(s) ? "'" : '') + s.replaceAll('"', '""')}"`;
  return '\uFEFF' + [['DEMO — Gerçek mükellef verisi değildir'], ['Unvan', 'Maskeli kimlik', 'Firma türü', 'İl', 'NACE', 'Sorumlu', 'Mali müşavir', 'Sözleşme'], ...firms.map(f => [f.name, f.identity, f.legalType, f.city, f.nace, f.staff, f.accountant, f.contract])].map(row => row.map(cell).join(';')).join('\r\n');
}

// Bu bayraklar yalnız React belleğindeki demo senaryosudur; gerçek izin veya onay oluşturmaz.
export type DemoPortfolioAction = 'archive' | 'restore' | 'consent' | 'revoke-consent' | 'grant' | 'revoke';
export function portfolioAction(firm: PortfolioFirm, action: DemoPortfolioAction): PortfolioFirm {
  if (action === 'archive') return { ...firm, archived: 'Evet', usePermission: 'Verilmedi' };
  if (action === 'restore') return { ...firm, archived: 'Hayır' };
  if (firm.archived === 'Evet') return firm;
  if (action === 'consent') return { ...firm, consent: 'Alındı' };
  if (action === 'revoke-consent') return { ...firm, consent: 'Alınmadı', usePermission: 'Verilmedi' };
  if (action === 'grant') return firm.consent === 'Alındı' && !!(firm.gibUser || firm.sgkUser) ? { ...firm, usePermission: 'Verildi' } : firm;
  return { ...firm, usePermission: 'Verilmedi' };
}
