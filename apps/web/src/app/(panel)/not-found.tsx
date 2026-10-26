import Link from 'next/link';
import { Simge } from '@/shared/ui/Simge.tsx';

// Portal içinde bulunamayan sayfa ya da başka ofisin kaydı (kural 1: 404): üst çubuk (kabuk) yerinde kalır; kaydın varlığı
// hakkında bilgi verilmez. Portal dışı adresler kök not-found.tsx'e düşer.
export default function PanelBulunamadi() {
  return (
    <section className="kart yasak">
      <h1>Sayfa bulunamadı</h1>
      <p>Aradığınız sayfa ya da kayıt yok veya görüntüleme yetkiniz dışında.</p>
      <Link className="dugme ikincil" href="/">
        <Simge ad="left" />
        Ana sayfaya dön
      </Link>
    </section>
  );
}
