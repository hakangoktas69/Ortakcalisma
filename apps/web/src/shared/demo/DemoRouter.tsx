'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { demoPageForPath, demoModuleCards } from './catalog.ts';
import { DemoCards } from './DemoCards.tsx';
import { DemoWorkspace } from './DemoWorkspace.tsx';
import type { DemoPage } from './model.ts';
import { features } from '@eworks/feature-registry';

const groups: Record<string, { title: string; modules: string[] }> = {
  gunluk: { title: 'Günlük Yönetim', modules: ['firmalar', 'beyanname', 'sgk', 'edefter', 'tebligat', 'dilekceler', 'faturalar', 'gorevler', 'notlar', 'kisayollar', 'raporlar'] },
  ofis: { title: 'Ofis ve Destek', modules: ['yonetim', 'ayarlar', 'bildirimler', 'destek'] },
  odeme: { title: 'Ödeme', modules: ['odeme'] },
};

export function DemoRouter({ pages, namespace }: { pages: DemoPage[]; namespace: string }) {
  const pathname = usePathname();
  const page = demoPageForPath(pages, pathname);
  if (page) return <DemoWorkspace key={page.key} page={page} pages={pages} namespace={namespace} />;
  const module = pathname.split('/')[1] ?? '';
  const category = pathname.startsWith('/kategori/') ? groups[pathname.split('/')[2] ?? ''] : undefined;
  const children = pages.filter(p => category ? category.modules.includes(p.key.split('.')[0] ?? '') : p.key.split('.')[0] === module);
  if (!children.length || (!category && pathname.slice(1).includes('/'))) return <section className="kart"><h1>Sayfa kullanılamıyor</h1><p>Bu adres bulunamadı veya bu bölüm için yetkiniz yok.</p><Link href="/" className="dugme ikincil">Ana sayfaya dön</Link></section>;
  const cards = category ? demoModuleCards(pages, category.modules) : children.map(p => ({ title: p.title, path: p.path, description: 'Bölümü aç' }));
  const title = category?.title ?? features[module]?.title ?? 'Bölüm sayfaları';
  return <section className="demo-workspace demo-hub demo-reference-hub"><p className="demo-notice demo-notice-compact"><strong>DEMO · Tamamen kurgusal veriler</strong></p><div className="hub-yolu"><Link href="/">Ana Sayfa</Link><span aria-hidden="true">/</span><strong>{title}</strong></div>
    <div className="hub-baslik"><span className="hub-ust">{category?.title ?? 'Eworks çalışma alanı'}</span><h1>{title}</h1><p>İşlem yapmak istediğiniz bölümü seçin.</p></div>
    <DemoCards cards={cards} label="Bölüm sayfaları" />
  </section>;
}
