import { gorunurSayfalar, menuHedefi, ozellik, yol } from './ozellik.ts';
import type { SimgeAdi } from './Simge.tsx';

// Ana sayfa kategorileri (Mert'in Eworks tasarımı, eworks-tasarim.html CATEGORIES): yetki ağacının modüllerini gruplar.
// Yalnız gezinme düzenidir; yetki kararı vermez — kart, kullanıcının görebildiği modül/sayfa varsa gösterilir.

export type Kategori = {
  id: string;
  baslik: string;
  aciklama: string;
  simge: SimgeAdi;
  moduller: string[];
  /** Kart doğrudan bir sayfaya gidiyorsa (ör. Takvim) o anahtar; yoksa kategori sayfası açılır. */
  hedef?: string;
};

export const KATEGORILER: readonly Kategori[] = [
  {
    id: 'gunluk',
    baslik: 'Günlük Yönetim',
    aciklama: 'Mükellefler, beyannameler ve günlük işler',
    simge: 'home',
    moduller: ['firmalar', 'beyanname', 'tebligat', 'sgk', 'edefter', 'raporlar', 'dilekceler', 'faturalar', 'gorevler', 'notlar'],
  },
  { id: 'takvim', baslik: 'Takvim', aciklama: 'Vergi takvimi, önemli günler ve kişisel hatırlatmalar', simge: 'calendar', moduller: [], hedef: 'genel_bakis.takvim' },
  {
    id: 'ofis',
    baslik: 'Ofis ve Destek',
    aciklama: 'Kullanıcılar, ofis ayarları, yardım ve yenilikler',
    simge: 'chart',
    moduller: ['yonetim', 'ayarlar', 'bildirimler', 'destek'],
  },
  { id: 'odeme', baslik: 'Ödeme', aciklama: 'Ödemeler, borçlar ve ücret takibi', simge: 'wallet', moduller: ['odeme'] },
];

export const MODUL_SIMGESI: Record<string, SimgeAdi> = {
  firmalar: 'firms',
  beyanname: 'file',
  tebligat: 'mail',
  sgk: 'shield',
  edefter: 'book',
  raporlar: 'chart',
  dilekceler: 'clipboard',
  faturalar: 'invoice',
  gorevler: 'check',
  notlar: 'folder',
  yonetim: 'users',
  ayarlar: 'settings',
  bildirimler: 'bell',
  destek: 'help',
  odeme: 'wallet',
};

/** Anahtarın (modül, sayfa ya da işlem) kategorisi; menü dışıysa yok. */
export const kategoriBul = (anahtar: string): Kategori | undefined => {
  const modul = anahtar.split('.')[0]!;
  return KATEGORILER.find((k) => k.moduller.includes(modul));
};

export const kategoriYolu = (k: Kategori) => (k.hedef ? yol(k.hedef) : `/kategori/${k.id}`);

/** Ana sayfadaki kategori kartları: görebildiği bir modülü ya da hedef sayfası olan kategoriler. */
export const gorunurKategoriler = (gorunur: (k: string) => boolean) =>
  KATEGORILER.filter((c) => (c.hedef ? gorunur(c.hedef) : c.moduller.some(gorunur)));

/**
 * Sayfa başlığındaki dönüş düğmesi: çok sayfalı modülün sayfasından modül sayfasına (kardeş sayfaya bir tıkla geçilsin),
 * modülün kendisinden, tek sayfalı modülden ve tek modüllü kategoriden (Ödeme) kategoriye, menü dışından ana sayfaya.
 */
export function donusHedefi(anahtar: string): { href: string; baslik: string } {
  const kat = kategoriBul(anahtar);
  if (!kat) return { href: '/', baslik: 'Ana Sayfa' };
  const modul = anahtar.split('.')[0]!;
  if (anahtar !== modul && kat.moduller.length > 1 && gorunurSayfalar(modul, () => true).length > 1) return { href: yol(modul), baslik: ozellik(modul)?.title ?? modul };
  return { href: kategoriYolu(kat), baslik: kat.baslik };
}

export type ModulKarti = { anahtar: string; baslik: string; simge: SimgeAdi; href: string; sayfaSayisi: number };

const modulKarti = (m: string, gorunur: (k: string) => boolean): ModulKarti => {
  const s = gorunurSayfalar(m, gorunur);
  const href = s.length > 1 ? yol(m) : s.length === 1 ? yol(s[0]!) : yol(menuHedefi(m));
  return { anahtar: m, baslik: ozellik(m)?.title ?? m, simge: MODUL_SIMGESI[m] ?? 'grid', href, sayfaSayisi: s.length };
};

/**
 * Kategori sayfasındaki kartlar. Tek modüllü kategoride (Ödeme) modülün sayfaları kart olur; sayfası görünmüyorsa modül
 * kartı kalır (ana sayfa kartı boş sayfaya gitmesin). Modül kartı birden çok görünür sayfada modül sayfasına, tek sayfada
 * doğrudan o sayfaya, sayfasız modülde (Görevler) modülün kendi adresine gider.
 */
export function modulKartlari(kategoriId: string, gorunur: (k: string) => boolean): ModulKarti[] {
  const k = KATEGORILER.find((x) => x.id === kategoriId);
  if (!k) return [];
  if (k.moduller.length === 1) {
    const m = k.moduller[0]!;
    const s = gorunurSayfalar(m, gorunur);
    if (!s.length) return gorunur(m) ? [modulKarti(m, gorunur)] : [];
    return s.map((p) => ({ anahtar: p, baslik: ozellik(p)?.title ?? p, simge: MODUL_SIMGESI[m] ?? 'grid', href: yol(p), sayfaSayisi: 0 }));
  }
  return k.moduller.filter(gorunur).map((m) => modulKarti(m, gorunur));
}
