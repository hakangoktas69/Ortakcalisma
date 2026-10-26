import { describe, expect, it } from 'vitest';
import { features } from '@eworks/feature-registry';
import { donusHedefi, gorunurKategoriler, KATEGORILER, kategoriBul, kategoriYolu, modulKartlari } from './kategoriler.ts';
import { gorunurSayfalar, moduller, ozellik } from './ozellik.ts';

// Ana sayfa kategorileri (Mert'in Eworks tasarımı: Günlük Yönetim / Takvim / Ofis ve Destek / Ödeme) yetki ağacının
// modüllerini gruplar. Yeni modül eklenip bir kategoriye konmazsa kullanıcı ona ana sayfadan ulaşamaz; bu test yakalar.

const MENU_DISI = ['oturum', 'satis', 'genel_bakis'];
const hepsi = () => true;
/** Yetki ağacındaki "görünür": düğümün kendisi ya da bir altı izinli (Kabuk'taki gorunur ile aynı kural). */
const izinliden = (izinli: string[]) => {
  const g = (k: string): boolean => izinli.some((i) => k === i || k.startsWith(`${i}.`)) || Object.keys(features).some((x) => x.startsWith(`${k}.`) && izinli.includes(x));
  return g;
};

describe('kategoriler', () => {
  it('menüdeki her modül tam bir kategoride', () => {
    for (const m of moduller().filter((x) => !MENU_DISI.includes(x))) {
      const iceren = KATEGORILER.filter((k) => k.moduller.includes(m));
      expect(iceren.map((k) => k.id), m).toHaveLength(1);
    }
  });

  it('kategorideki modül ve hedef anahtarları yetki ağacında var', () => {
    for (const k of KATEGORILER) {
      for (const m of k.moduller) expect(ozellik(m)?.kind, m).toBe('module');
      if (k.hedef) expect(features[k.hedef], k.hedef).toBeDefined();
    }
  });

  it('kategori kimlikleri tekil ve adres güvenli', () => {
    const idler = KATEGORILER.map((k) => k.id);
    expect(new Set(idler).size).toBe(idler.length);
    for (const id of idler) expect(id).toMatch(/^[a-z]+$/);
  });

  it('modülün ve sayfanın kategorisi bulunur; menü dışı anahtar için yoktur', () => {
    expect(kategoriBul('beyanname')?.id).toBe('gunluk');
    expect(kategoriBul('beyanname.liste')?.id).toBe('gunluk');
    expect(kategoriBul('yonetim.kullanicilar')?.id).toBe('ofis');
    expect(kategoriBul('odeme.cari_kasa')?.id).toBe('odeme');
    expect(kategoriBul('genel_bakis.panel')).toBeUndefined();
    expect(kategoriBul('olmayan')).toBeUndefined();
  });

  it('kategori kartı tek hedefliyse doğrudan sayfaya, değilse kategori sayfasına gider', () => {
    expect(kategoriYolu(KATEGORILER.find((k) => k.id === 'takvim')!)).toBe('/genel_bakis/takvim');
    expect(kategoriYolu(KATEGORILER.find((k) => k.id === 'gunluk')!)).toBe('/kategori/gunluk');
  });

  it('görünür kategoriler: yalnız görebildiği modülü ya da hedefi olan kategori', () => {
    expect(gorunurKategoriler(hepsi).map((k) => k.id)).toEqual(['gunluk', 'takvim', 'ofis', 'odeme']);
    const personel = gorunurKategoriler(izinliden(['genel_bakis', 'firmalar.liste', 'ayarlar.profil'])).map((k) => k.id);
    expect(personel).toEqual(['gunluk', 'takvim', 'ofis']);
    expect(gorunurKategoriler(() => false)).toEqual([]);
  });

  it('modül kartı: birden çok görünür sayfa → modül sayfası, tek sayfa → o sayfa, sayfasız → modülün kendisi', () => {
    const kart = (m: string, gorunur: (k: string) => boolean = hepsi) => modulKartlari('gunluk', gorunur).find((x) => x.anahtar === m);
    expect(kart('beyanname')?.href).toBe('/beyanname');
    expect(kart('tebligat')?.href).toBe('/tebligat/liste');
    expect(kart('gorevler')?.href).toBe('/gorevler');
    expect(kart('beyanname', (k) => !k.startsWith('beyanname.') || k.startsWith('beyanname.liste'))?.href).toBe('/beyanname/liste');
  });

  it('modül kartları yalnız görünür modülleri içerir; ödeme kategorisi sayfaları kart olarak gösterir', () => {
    expect(modulKartlari('ofis', (k) => !k.startsWith('yonetim')).map((x) => x.anahtar)).not.toContain('yonetim');
    const odeme = modulKartlari('odeme', hepsi);
    expect(odeme.map((x) => x.anahtar)).toContain('odeme.cari_kasa');
    expect(odeme.find((x) => x.anahtar === 'odeme.cari_kasa')?.href).toBe('/odeme/cari_kasa');
    expect(modulKartlari('olmayan', hepsi)).toEqual([]);
  });

  it('tek modüllü kategoride modül görünür ama sayfası görünmüyorsa modül kartı kalır (ana sayfa kartı boş sayfaya gitmez)', () => {
    const yalnizModul = (k: string) => k === 'odeme';
    expect(modulKartlari('odeme', yalnizModul).map((x) => x.anahtar)).toEqual(['odeme']);
  });

  it('görünür sayfalar: modülün yalnız sayfa düğümleri, görünürlük süzgeciyle', () => {
    expect(gorunurSayfalar('beyanname', hepsi)).toContain('beyanname.liste');
    expect(gorunurSayfalar('beyanname', hepsi)).not.toContain('beyanname.liste.view');
    expect(gorunurSayfalar('beyanname', (k) => k.startsWith('beyanname.kontrol'))).toEqual(['beyanname.kontrol']);
    expect(gorunurSayfalar('gorevler', hepsi)).toEqual([]);
  });

  it('dönüş: çok sayfalı modülün sayfası modüle, modülün kendisi ve tek sayfalı modül kategoriye, menü dışı ana sayfaya döner', () => {
    expect(donusHedefi('beyanname.liste')).toEqual({ href: '/beyanname', baslik: 'e-Beyanname' });
    expect(donusHedefi('beyanname')).toEqual({ href: '/kategori/gunluk', baslik: 'Günlük Yönetim' });
    expect(donusHedefi('tebligat.liste')).toEqual({ href: '/kategori/gunluk', baslik: 'Günlük Yönetim' });
    expect(donusHedefi('odeme.cari_kasa')).toEqual({ href: '/kategori/odeme', baslik: 'Ödeme' });
    expect(donusHedefi('gorevler')).toEqual({ href: '/kategori/gunluk', baslik: 'Günlük Yönetim' });
    expect(donusHedefi('genel_bakis.panel')).toEqual({ href: '/', baslik: 'Ana Sayfa' });
  });
});
