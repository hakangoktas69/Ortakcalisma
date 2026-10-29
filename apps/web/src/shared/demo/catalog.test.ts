import { describe, expect, it } from 'vitest';
import { demoCatalog, demoPageForPath, demoHomeCards, demoModuleCards } from './catalog.ts';

describe('demo gezinmesi yetki sınırları', () => {
  it('kategorilerde tek modül kartı vardır, çok sayfalı modül kendi alt bölümlerine gider', () => {
    const pages = demoCatalog(() => true);
    const cards = demoModuleCards(pages, ['firmalar', 'beyanname', 'edefter']);
    expect(cards.map(c => c.title)).toEqual(['Firmalarım', 'e-Beyanname', 'e-Defter']);
    expect(cards.find(c => c.title === 'e-Beyanname')?.path).toBe('/beyanname');
    expect(cards.find(c => c.title === 'e-Defter')?.path).toBe('/edefter/liste');
    expect(demoModuleCards(demoCatalog(key => key === 'sgk.ebildirge.view'), ['firmalar', 'sgk']).map(c => c.title)).toEqual(['SGK']);
  });
  it('ana sayfa yalnız dört kategori gösterir; kendisine dönüş bağlantısı üretmez', () => {
    const pages = demoCatalog(() => true);
    const cards = demoHomeCards(pages);
    expect(cards.map(c => c.title)).toEqual(['Günlük Yönetim', 'Takvim', 'Ofis ve Destek', 'Ödeme']);
    expect(cards.some(c => c.path === '/')).toBe(false);
    expect(demoHomeCards(demoCatalog(key => key === 'sgk.ebildirge.view')).map(c => c.title)).toEqual(['Günlük Yönetim']);
    expect(demoHomeCards([])).toEqual([]);
  });
  it('yetkisiz sayfa ve işlem başlığı istemciye gönderilmez', () => {
    const pages = demoCatalog(key => key === 'sgk.ebildirge.view');
    expect(pages.map(p => p.key)).toEqual(['sgk.ebildirge']);
    expect(pages[0]?.actions.map(a => a.key)).toEqual(['sgk.ebildirge.view']);
    expect(demoPageForPath(pages, '/yonetim/kullanicilar')).toBeUndefined();
  });
  it('bilinmeyen adres başka bir sayfaya dönüştürülmez', () => {
    const pages = demoCatalog(() => true);
    expect(demoPageForPath(pages, '/bilinmeyen')).toBeUndefined();
    expect(demoPageForPath(pages, '/edefter/liste/')?.key).toBe('edefter.liste');
    expect(demoPageForPath(pages, '/firmalar/kart/yeni')?.key).toBe('firmalar.kart');
  });
});
