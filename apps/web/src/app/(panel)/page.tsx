import { sayfaIzni } from '@/bff/oturum.ts';
import { Gelistiriliyor, Yasak } from '@/shared/ui/Sayfa.tsx';

// Ana sayfa (genel_bakis.panel). Sayaçlar çalışma alanı aşamasında (G) gelir; o zamana kadar durum listesi.
export default async function AnaSayfa() {
  const { izinli } = await sayfaIzni('genel_bakis.panel.view');
  return izinli ? <Gelistiriliyor k="genel_bakis.panel" /> : <Yasak />;
}
