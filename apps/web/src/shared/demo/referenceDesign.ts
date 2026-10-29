import type { DemoRow } from './model.ts';

// Birebir karşılığı saptanan ekranlar. Yeni demo özellikleri bu listeye kendiliğinden girmez.
const PAGES = new Set([
  'genel_bakis.panel', 'genel_bakis.takvim', 'firmalar.liste', 'kisayollar',
  'beyanname.liste', 'beyanname.kontrol', 'beyanname.pilot_bolge', 'tebligat.liste',
  'sgk.kontrol', 'sgk.ebildirge', 'sgk.ise_giris_cikis', 'sgk.erapor', 'sgk.is_kazasi', 'edefter.liste',
  'dilekceler.tum', 'dilekceler.borc_durum', 'faturalar.efatura', 'faturalar.earsiv', 'faturalar.fis', 'faturalar.tevkifat',
  'raporlar.pos', 'raporlar.kayitli_araclar', 'raporlar.ticaret_sicil', 'raporlar.karsit_inceleme',
  'odeme.aylik_liste', 'odeme.cari_kasa', 'odeme.borclar', 'odeme.online', 'odeme.ucretler', 'odeme.istatistikler', 'odeme.ayarlar',
  'yonetim.kullanicilar', 'yonetim.mukellef_kullanicilari', 'ayarlar.profil', 'ayarlar.iletisim', 'ayarlar.mukellef_gruplari', 'ayarlar.portal_kullanimi',
  'destek.uzmana_sor', 'destek.oneriler', 'destek.sss', 'destek.yenilikler',
]);
export const referencePage = (key: string): boolean => PAGES.has(key);
export const referenceCard = (path: string): boolean => {
  if (['/kategori/gunluk', '/kategori/ofis', '/kategori/odeme'].includes(path)) return true;
  const key = path.slice(1).replaceAll('/', '.');
  return referencePage(key) || [...PAGES].some(p => p.startsWith(`${key}.`));
};
export const referenceStats = (rows: DemoRow[]): number[] => [rows.length, rows.filter(r => r.status === 'Tamamlandı').length, rows.filter(r => r.status === 'Bekliyor').length, rows.filter(r => r.status === 'Kontrol gerekli').length];
export const referenceDate = (date: string): string => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('.') : date;
