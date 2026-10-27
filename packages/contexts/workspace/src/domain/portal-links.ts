// Portal kısayolları (Mert'in 26.10 "Portal Kısayolları" ekranı): kurumların resmî giriş sayfaları. Yalnız bağlantıdır;
// Eworks bu sayfalara kurum şifresi ya da oturum aktarmaz (kural 2–3: şifre tarayıcıya gitmez, kullanıcı tarafında kurulum yok).
// Adresler Mert'in pilotunda kullanılan resmî sayfalardır; kurum adresi değiştirirse burada güncellenir.

export type PortalGroup = 'gib' | 'sgk';
export type PortalLink = { readonly id: string; readonly group: PortalGroup; readonly title: string; readonly url: string; readonly description: string };

export const PORTAL_GROUPS: readonly { id: PortalGroup; title: string }[] = [
  { id: 'gib', title: 'GİB' },
  { id: 'sgk', title: 'SGK' },
];

export const PORTAL_LINKS: readonly PortalLink[] = [
  { id: 'dijital', group: 'gib', title: 'Dijital Vergi Dairesi', url: 'https://dijital.gib.gov.tr/portal/login', description: 'Vergi levhası, borç sorgulama ve e-Tebligat.' },
  { id: 'ivd', group: 'gib', title: 'İnternet Vergi Dairesi', url: 'https://intvrg.gib.gov.tr/', description: 'Mükellef işlemleri ve sözleşmeler.' },
  { id: 'ebeyanname', group: 'gib', title: 'e-Beyanname', url: 'https://ebeyanname.gib.gov.tr/', description: 'Beyanname gönderme ve sorgulama.' },
  { id: 'edefter', group: 'gib', title: 'e-Defter', url: 'https://edefter.gib.gov.tr/global/login', description: 'e-Defter uygulaması ve berat işlemleri.' },
  { id: 'earsiv', group: 'gib', title: 'e-Arşiv Fatura', url: 'https://earsivportal.efatura.gov.tr/intragiris.html', description: 'e-Arşiv fatura portalı girişi.' },
  { id: 'ebildirge', group: 'sgk', title: 'SGK e-Bildirge V2', url: 'https://ebildirge.sgk.gov.tr/EBildirgeV2', description: 'Aylık prim ve hizmet belgesi işlemleri.' },
  { id: 'tescil', group: 'sgk', title: 'İşe Giriş / İşten Çıkış', url: 'https://uyg.sgk.gov.tr/SigortaliTescil/', description: 'Sigortalı tescil uygulaması.' },
  { id: 'isveren', group: 'sgk', title: 'İşveren Sistemi', url: 'https://e.sgk.gov.tr/Uygulamalar/Detay/Isveren-Sistemi-2022-10-31-10-05-50', description: 'SGK işveren uygulamaları sayfası.' },
  {
    id: 'erapor',
    group: 'sgk',
    title: 'SGK e-Rapor',
    url: 'https://e.sgk.gov.tr/Uygulamalar/Detay/Calisilmadigina-Dair-Bildirim-Girisi-4A-2025-12-19-11-26-07',
    description: 'Çalışılmadığına dair bildirim girişi.',
  },
];
