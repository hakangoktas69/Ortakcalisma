import Link from 'next/link';
import { referenceCard } from './referenceDesign.ts';
import { Simge, type SimgeAdi } from '../ui/Simge.tsx';
import type { DemoTile } from './catalog.ts';

const ICONS: Record<string, SimgeAdi> = {
  gunluk: 'home', takvim: 'calendar', genel_bakis: 'calendar', ofis: 'chart', odeme: 'wallet',
  firmalar: 'firms', beyanname: 'file', sgk: 'shield', edefter: 'book', tebligat: 'mail',
  dilekceler: 'clipboard', faturalar: 'invoice', gorevler: 'check', notlar: 'folder',
  kisayollar: 'link', raporlar: 'chart', yonetim: 'users', ayarlar: 'settings', bildirimler: 'bell', destek: 'help',
};

export function demoIcon(path: string): SimgeAdi {
  const parts = path.split('/').filter(Boolean);
  return ICONS[parts[0] === 'kategori' ? parts[1] ?? '' : parts[0] ?? ''] ?? 'grid';
}

/** Eski Eworks ile aynı kart yapısı: lacivert geçiş, altın simge/şerit ve iki sütunlu ana menü. */
export function DemoCards({ cards, label, large = false }: { cards: DemoTile[]; label: string; large?: boolean }) {
  return <nav aria-label={label}><ul className={`kart-izgara${large ? ' buyuk' : ''}`}>
    {cards.map(card => <li key={card.path}><Link className="kategori-karti" data-reference-card={referenceCard(card.path) ? "true" : undefined} href={card.path}>
      <span className="kart-simge"><Simge ad={demoIcon(card.path)} /></span>
      <span className="kart-metin"><b>{card.title}</b><small>{card.description}</small>{card.count ? <em>{card.count} alt bölüm</em> : null}</span>
      <span className="kart-ok"><Simge ad="right" /></span>
    </Link></li>)}
  </ul></nav>;
}
