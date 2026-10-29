import { describe, it, expect } from 'vitest';
import { portfolioFirms, portfolioFilter, portfolioProblem, portfolioCsv, approvePortfolio, toggleVisibleFirms, emptyPortfolioFilters } from './firmPortfolio.ts';

describe('demo mükellef portföyü', () => {
  it('özetler, e-belge ve kurum eksiklikleri birlikte süzülür; Türkçe unvan öne çıkar', () => {
    expect(portfolioFilter(portfolioFirms, { ...emptyPortfolioFilters, segment: 'pending' })).toHaveLength(1);
    expect(portfolioFilter(portfolioFirms, { ...emptyPortfolioFilters, quick: 'sgkWrong' }).map(f => f.id)).toEqual(['mavi']);
    expect(portfolioFilter(portfolioFirms, { ...emptyPortfolioFilters, quick: 'gibMissing' }).map(f => f.id)).toEqual(['ornek']);
    expect(portfolioFilter(portfolioFirms, { ...emptyPortfolioFilters, quick: 'invoice' })).toHaveLength(2);
    expect(portfolioFilter(portfolioFirms, { ...emptyPortfolioFilters, search: 'insaat', type: 'Kurum', staff: 'Demo Ece' }).map(f => f.id)).toEqual(['mavi']);
    expect(portfolioFilter(portfolioFirms, { ...emptyPortfolioFilters, search: 'bulunmayan' })).toEqual([]);
  });
  it('görünenleri seçme gizli seçimleri korur; toplu onay yalnız seçili firmaları etkiler', () => {
    expect(toggleVisibleFirms(['atlas'], ['mavi'])).toEqual(['atlas', 'mavi']);
    expect(toggleVisibleFirms(['atlas', 'mavi'], ['mavi'])).toEqual(['atlas']);
    const approved = approvePortfolio(portfolioFirms, ['ornek']);
    expect(approved.find(f => f.id === 'ornek')?.state).toBe('Onaylanmış');
    expect(portfolioFirms.find(f => f.id === 'ornek')?.state).toBe('Onay bekliyor');
    expect(approved[0]).toBe(portfolioFirms[0]);
  });
  it('gerçek kimlik/adres, yinelenen kimlik ve negatif hasılat kabul edilmez', () => {
    const f = portfolioFirms[0]; if (!f) throw new Error('Örnek eksik');
    expect(portfolioProblem(f, portfolioFirms)).toBeNull();
    for (const patch of [{ name: 'Gerçek Firma' }, { identity: '12345678901' }, { email: 'biri@example.com' }, { revenue: '-1' }, { id: 'yeni', identity: f.identity }]) expect(portfolioProblem({ ...f, ...patch }, portfolioFirms)).not.toBeNull();
  });
  it('CSV yalnız görünür firma bilgisini dışa aktarır ve formülleri kaçırır', () => {
    const f = portfolioFirms[0]; if (!f) throw new Error('Örnek eksik');
    const csv = portfolioCsv([{ ...f, name: '=SUM(1,2)' }]);
    expect(csv).toContain('DEMO'); expect(csv).toContain("'=SUM"); expect(csv).not.toContain('DEMO-GIB');
    expect(csv).not.toContain('Demo Mavi');
  });
});
