import { notFound } from 'next/navigation';
import { sayfaIzni } from '@/bff/oturum.ts';
import { MODUL_SIMGESI } from '@/shared/ui/kategoriler.ts';
import { altlar, gorunur, gorunurSayfalar, ozellik, yol } from '@/shared/ui/ozellik.ts';
import { Baslik, Gelistiriliyor, Kartlar, Yasak } from '@/shared/ui/Sayfa.tsx';

// Özellik ağacındaki her modül/sayfa erişilebilir; henüz uygulanmamış olanlar geliştirme kipinde "Geliştiriliyor", demo/üretimde "yakında" olarak gösterilir (D22, D39).
// Uygulanmış sayfaların kendi rotası vardır ve bu genel rotadan önce eşleşir. Sayfalı modül (ör. /beyanname) alt sayfa
// kartlarıyla açılır; kartlar yalnız kullanıcının görebildiği sayfalardır ve her biri özellik durumunu gösterir.
export default async function GenelSayfa({ params }: { params: Promise<{ yol: string[] }> }) {
  const anahtar = (await params).yol.join('.');
  const f = ozellik(anahtar);
  if (!f || f.kind === 'action' || anahtar.startsWith('satis')) notFound();
  const goruntule = f.kind === 'page' ? (altlar(anahtar).find((a) => a.endsWith('.view')) ?? altlar(anahtar)[0] ?? anahtar) : anahtar;
  const { oturum, izinli } = await sayfaIzni(goruntule);
  // Modül sayfası yalnız gezinmedir: kullanıcının görebildiği alt sayfaların bağlantılarını listeler, içerik göstermez. Bu
  // yüzden modülün tamamına değil, en az bir alt sayfaya yetki yeter (personel `firmalar.liste` ile Firmalarım'ı açar);
  // her sayfa kendi anahtarını denetler. Görünür sayfası olmayan modülde ve sayfa düğümünde karar `izinli`dir.
  const sayfalar = f.kind === 'module' ? gorunurSayfalar(anahtar, (k) => gorunur(oturum, k)) : [];
  if (!sayfalar.length) return izinli ? <Gelistiriliyor k={anahtar} /> : <Yasak />;
  const simge = MODUL_SIMGESI[anahtar] ?? 'grid';
  return (
    <>
      <Baslik k={anahtar} alt="Çalışmak istediğiniz bölümü seçin." />
      <Kartlar etiket={`${f.title} bölümleri`} kartlar={sayfalar.map((p) => ({ anahtar: p, baslik: ozellik(p)?.title ?? p, simge, href: yol(p), ozellikAnahtari: p }))} />
    </>
  );
}
