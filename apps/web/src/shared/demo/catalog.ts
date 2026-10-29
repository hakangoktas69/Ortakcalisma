import { features } from '@eworks/feature-registry';
import { demoPageKeys, type DemoPage } from './model.ts';

export function demoHomeCards(pages: DemoPage[]): { title: string; description: string; path: string }[] {
  const groups = [
    { title: 'Günlük Yönetim', description: 'Mükellefler, beyannameler ve günlük işler', path: '/kategori/gunluk', modules: ['firmalar', 'beyanname', 'sgk', 'edefter', 'tebligat', 'dilekceler', 'faturalar', 'gorevler', 'notlar', 'kisayollar', 'raporlar'] },
    { title: 'Takvim', description: 'Vergi takvimi ve kişisel hatırlatmalar', path: '/genel_bakis/takvim', modules: ['genel_bakis.takvim'] },
    { title: 'Ofis ve Destek', description: 'Ofis yönetimi, ayarlar ve yardım', path: '/kategori/ofis', modules: ['yonetim', 'ayarlar', 'bildirimler', 'destek'] },
    { title: 'Ödeme', description: 'Ödemeler, borçlar ve ücret takibi', path: '/kategori/odeme', modules: ['odeme'] },
  ];
  return groups.filter(group => pages.some(page => group.modules.some(module => page.key === module || page.key.startsWith(`${module}.`))));
}

/** Yetkili sayfalar ve işlemler sunucuda süzülür; istemciye oturum/grant/CSRF bilgisi gönderilmez. */
export function demoCatalog(can: (key: string) => boolean): DemoPage[] {
  return demoPageKeys().flatMap(key => {
    const feature = features[key];
    if (!feature) return [];
    const actions = Object.entries(features).filter(([k, f]) => f.kind === 'action' && k.startsWith(`${key}.`) && k.split('.').length === key.split('.').length + 1);
    const view = actions.find(([k]) => k.endsWith('.view') || k.endsWith('.view_status')) ?? actions[0];
    if (!view || !can(view[0])) return [];
    return [{ key, title: feature.title, path: key === 'genel_bakis.panel' ? '/' : `/${key.replaceAll('.', '/')}`,
      actions: actions.filter(([k]) => can(k)).map(([k, f]) => ({ key: k, title: f.title })) }];
  });
}

export function demoPageForPath(pages: DemoPage[], path: string): DemoPage | undefined {
  const clean = path.replace(/\/$/, '') || '/';
  return pages.find(p => p.path === clean) ?? (clean.startsWith('/firmalar/kart/') ? pages.find(p => p.key === 'firmalar.kart') : undefined);
}

export type DemoTile = { title: string; path: string; description: string; count?: number };

/** Kategori → modül → sayfa: eski Eworks'ün gezinme sırası, yalnız izinli demo kataloğundan. */
export function demoModuleCards(pages: DemoPage[], modules: string[]): DemoTile[] {
  if (modules.length === 1) return pages.filter(page => page.key.split('.')[0] === modules[0]).map(page => ({ title: page.title, path: page.path, description: 'Bölümü aç' }));
  return modules.flatMap(module => {
    const children = pages.filter(page => page.key.split('.')[0] === module);
    const first = children[0];
    if (!first) return [];
    return [{ title: features[module]?.title ?? first.title, path: children.length > 1 ? `/${module}` : first.path,
      description: children.length > 1 ? 'Alt bölümleri görüntüle' : 'Bölümü aç', ...(children.length > 1 ? { count: children.length } : {}) }];
  });
}
