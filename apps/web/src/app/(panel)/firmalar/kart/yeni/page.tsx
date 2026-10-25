import { sayfaIzni } from '@/bff/oturum.ts';
import { FirmaFormu } from '@/features/portfolio/FirmaFormu.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

export default async function YeniFirma() {
  const { oturum, izinli } = await sayfaIzni('firmalar.kart.create');
  if (!izinli) return <Yasak />;
  return (
    <>
      <Baslik k="firmalar.kart" alt="Yeni mükellef kartı. VKN/TCKN sistem genelinde tekildir; firma müşavir portföyünüze eklenir." />
      <FirmaFormu csrf={oturum.csrf} />
    </>
  );
}
