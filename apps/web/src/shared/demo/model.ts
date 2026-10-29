import { features } from '@eworks/feature-registry';

// Yalnız sunum fikstürleri. Kurum istemcisi, kimlik bilgisi ve iş veritabanına bağımlılık yoktur.
export const demoEnabled = (env: Record<string, string | undefined>): boolean =>
  env['YIGIN_KIPI'] === 'demo' && env['EWORKS_ORTAM'] === 'demo' && env['OZELLIK_DURUMU_GOSTER'] !== 'true';

export type DemoRow = { id: string; firm: string; title: string; period: string; date: string; status: string; amount: number; employees: number; note: string };
export type DemoAction = { key: string; title: string };
export type DemoPage = { key: string; title: string; path: string; actions: DemoAction[] };
export type DemoFilter = { search: string; firm: string; period: string; status: string };
export function nextDemoId(rows: DemoRow[], key: string): string {
  const ids = new Set(rows.map(row => row.id));
  let next = rows.length + 1;
  while (ids.has(`demo-local-${key}-${next}`)) next++;
  return `demo-local-${key}-${next}`;
}
export const DEMO_FIRMS = ['Demo Atlas Teknoloji Ltd.', 'Demo Mavi İnşaat A.Ş.', 'Demo Örnek Danışmanlık'];
export const DEMO_PERIODS = ['2026-09', '2026-08', '2026-07'];

export const demoPageKeys = (): string[] => [
  ...Object.entries(features).filter(([k, f]) => f.kind === 'page' && !k.startsWith('satis.') && !k.startsWith('oturum.')).map(([k]) => k),
  'gorevler', 'notlar', 'bildirimler', 'kisayollar',
];

const TITLES: Record<string, string[]> = {
  firmalar: ['Kurum hesabı ve sözleşme kontrolü', 'Firma bilgileri', 'Mükellef onayı'],
  beyanname: ['KDV1 beyannamesi ve tahakkuku', 'MUHSGK beyannamesi', 'KDV2 beyannamesi'],
  sgk: ['SGK tahakkuku ve hizmet listesi', 'İşe giriş bildirimi', 'Çalışmazlık bildirimi'],
  edefter: ['Yevmiye ve kebir beratları', 'Yevmiye ve kebir beratları', 'Yevmiye ve kebir beratları'],
  tebligat: ['Örnek bilgilendirme tebligatı', 'Örnek vergi dairesi yazısı', 'Örnek hatırlatma bildirimi'],
  dilekceler: ['Borç durum yazısı talebi', 'Genel amaçlı dilekçe taslağı', 'Bilgi talep dilekçesi'],
  faturalar: ['Örnek hizmet faturası', 'Örnek satış faturası', 'Örnek gider fişi'],
  odeme: ['Aylık müşavirlik ücreti', 'Örnek SGK prim borcu', 'Örnek vergi borcu'],
  raporlar: ['Aylık kontrol raporu', 'Firma karşılaştırma raporu', 'Dönem özeti'],
  yonetim: ['Demo ofis yöneticisi', 'Demo ofis personeli', 'Demo denetim olayı'],
  ayarlar: ['Demo ofis profili', 'Demo iletişim tercihleri', 'Demo mükellef grubu'],
  destek: ['Portal kullanım rehberi', 'Örnek destek talebi', 'Yeni özellik önerisi'],
  gorevler: ['Beyanname kontrolü', 'SGK belgelerini incele', 'Dönem dosyasını hazırla'],
  notlar: ['Firma görüşmesi notu', 'Dönem kontrol notu', 'Ofis içi hatırlatma'],
  bildirimler: ['Yaklaşan örnek son gün', 'Örnek aktarım tamamlandı', 'Örnek belge kontrolü'],
  genel_bakis: ['Beyanname hatırlatması', 'SGK hatırlatması', 'e-Defter hatırlatması'],
  kisayollar: ['Dijital Vergi Dairesi', 'SGK e-Bildirge', 'e-Defter'],
};

export function sampleRows(key: string): DemoRow[] {
  const module = key.split('.')[0] ?? '';
  const titles = TITLES[module] ?? ['Örnek dönem kaydı'];
  return Array.from({ length: 9 }, (_, i) => ({
    id: `demo-${key}-${i + 1}`, firm: DEMO_FIRMS[i % 3] ?? 'Demo Firma',
    title: titles[i % titles.length] ?? 'Örnek kayıt', period: DEMO_PERIODS[Math.floor(i / 3)] ?? '2026-09',
    date: `2026-${String(9 - Math.floor(i / 3)).padStart(2, '0')}-${String(10 + i).padStart(2, '0')}`,
    status: ['Tamamlandı', 'Bekliyor', 'Kontrol gerekli'][i % 3] ?? 'Bekliyor',
    amount: 1250 + i * 475, employees: 3 + i,
    note: 'Tamamen kurgusal demo kaydıdır. Gerçek mükellef, kurum sonucu veya resmi belge değildir.',
  }));
}

export function filterRows(rows: DemoRow[], filter: DemoFilter): DemoRow[] {
  const search = filter.search.trim().toLocaleLowerCase('tr-TR');
  return rows.filter(r => (!search || `${r.firm} ${r.title} ${r.note}`.toLocaleLowerCase('tr-TR').includes(search)) &&
    (!filter.firm || r.firm === filter.firm) && (!filter.period || r.period === filter.period) && (!filter.status || r.status === filter.status));
}

export function csvDocument(rows: DemoRow[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + [['DEMO — Resmi veri değildir'], ['Firma', 'Açıklama', 'Dönem', 'Durum', 'Tutar'],
    ...rows.map(r => [r.firm, r.title, r.period, r.status, r.amount])].map(row => row.map(cell).join(';')).join('\r\n');
}

/** ASCII PDF: basit örnek belge, geçerli byte ofsetleri ve zorunlu demo filigranı. */
export function pdfDocument(title: string): string {
  const safe = title.normalize('NFD').replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '');
  const stream = `BT /F1 20 Tf 50 750 Td (DEMO - ORNEK BELGE) Tj 0 -35 Td /F1 12 Tf (${safe.slice(0, 80)}) Tj 0 -30 Td (Resmi belge degildir. Gercek kurum verisi icermez.) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const [i, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const start = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return pdf;
}
