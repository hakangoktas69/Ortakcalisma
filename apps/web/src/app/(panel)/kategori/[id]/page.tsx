import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { oturum as oturumAl } from '@/bff/oturum.ts';
import { KATEGORILER, modulKartlari } from '@/shared/ui/kategoriler.ts';
import { gorunur } from '@/shared/ui/ozellik.ts';
import { Kartlar, Yasak } from '@/shared/ui/Sayfa.tsx';

// Kategori sayfası (Günlük Yönetim, Ofis ve Destek, Ödeme): kullanıcının görebildiği modüllerin kartları. Yalnız gezinmedir,
// içerik göstermez: tek bir yetki anahtarına bağlı değildir (yetki-anahtarlari.test.ts ACIK), oturum ister ve yalnız
// görebildiği modülleri listeler; her modül/sayfa kendi anahtarını ayrıca denetler. Ana sayfa yetkisi kapatılmış
// kullanıcı da izinli modüllerine buradan ulaşır.
export default async function KategoriSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const oturum = await oturumAl();
  if (!oturum) redirect('/giris');
  const { id } = await params;
  const kat = KATEGORILER.find((k) => k.id === id);
  if (!kat || kat.hedef) notFound();
  const kartlar = modulKartlari(kat.id, (k) => gorunur(oturum, k));
  if (!kartlar.length) return <Yasak />;
  return (
    <>
      <nav className="hub-yolu" aria-label="Konum">
        <Link href="/">Ana Sayfa</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{kat.baslik}</span>
      </nav>
      <div className="hub-baslik">
        <p className="hub-ust">Eworks çalışma alanı</p>
        <h1>{kat.baslik}</h1>
        <p>{kat.aciklama}</p>
      </div>
      <Kartlar
        etiket={`${kat.baslik} modülleri`}
        kartlar={kartlar.map((c) => ({
          anahtar: c.anahtar,
          baslik: c.baslik,
          simge: c.simge,
          href: c.href,
          ...(c.sayfaSayisi > 1 ? { ek: `${c.sayfaSayisi} bölüm` } : {}),
          ozellikAnahtari: c.anahtar,
        }))}
      />
    </>
  );
}
