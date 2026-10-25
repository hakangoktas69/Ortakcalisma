import { notFound } from 'next/navigation';
import { sayfaIzni } from '@/bff/oturum.ts';
import { altlar, ozellik } from '@/shared/ui/ozellik.ts';
import { Gelistiriliyor, Yasak } from '@/shared/ui/Sayfa.tsx';

// Özellik ağacındaki her modül/sayfa erişilebilir; henüz uygulanmamış olanlar "Geliştiriliyor" olarak gösterilir (D22, D30).
// Uygulanmış sayfaların kendi rotası vardır ve bu genel rotadan önce eşleşir.
export default async function GenelSayfa({ params }: { params: Promise<{ yol: string[] }> }) {
  const anahtar = (await params).yol.join('.');
  const f = ozellik(anahtar);
  if (!f || f.kind === 'action' || anahtar.startsWith('satis')) notFound();
  const goruntule = f.kind === 'page' ? (altlar(anahtar).find((a) => a.endsWith('.view')) ?? altlar(anahtar)[0] ?? anahtar) : anahtar;
  const { izinli } = await sayfaIzni(goruntule);
  return izinli ? <Gelistiriliyor k={anahtar} /> : <Yasak />;
}
