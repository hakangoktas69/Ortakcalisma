import Link from 'next/link';

// Bulunamayan adres ve başka ofisin kaydı (kural 1: 404) için tek, sade Türkçe sayfa; kaydın varlığı hakkında bilgi vermez.
export default function Bulunamadi() {
  return (
    <main className="bulunamadi">
      <section className="kart">
        <h1>Sayfa bulunamadı</h1>
        <p>Aradığınız sayfa ya da kayıt yok veya görüntüleme yetkiniz dışında.</p>
        <Link className="dugme birincil" href="/">
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
