import { Marka } from '@/shared/ui/Marka.tsx';

export default function Bulunamadi() {
  return (
    <main className="giris">
      <div className="giris-kart">
        <Marka />
        <h1>Sayfa bulunamadı</h1>
        <a href="/">Ofis listesine dön</a>
      </div>
    </main>
  );
}
