import Link from 'next/link';
import { FeatureBadge } from './FeatureBadge.tsx';
import { donusHedefi, kategoriBul } from './kategoriler.ts';
import { altlar, ozellik } from './ozellik.ts';
import { Simge, type SimgeAdi } from './Simge.tsx';

/** Bir üst düzeye dönüş ("← e-Beyanname", "← Günlük Yönetim"); kural `donusHedefi`'nde. */
export function Donus({ k }: { k: string }) {
  const d = donusHedefi(k);
  return (
    <div className="donus">
      <Link className="dugme ikincil" href={d.href}>
        <Simge ad="left" />
        {d.baslik}
      </Link>
    </div>
  );
}

export function Baslik({ k, alt, children }: { k: string; alt?: string; children?: React.ReactNode }) {
  const modul = k.split('.')[0]!;
  return (
    <>
      <Donus k={k} />
      <div className="baslik">
        <div>
          <p className="ust-satir">Eworks / {modul === k ? (kategoriBul(k)?.baslik ?? 'Çalışma alanı') : ozellik(modul)?.title}</p>
          <h1>
            {ozellik(k)?.title} <FeatureBadge k={k} />
          </h1>
          {alt ? <p className="alt">{alt}</p> : null}
        </div>
        {children ? <div className="eylemler">{children}</div> : null}
      </div>
    </>
  );
}

export type Kart = { anahtar: string; baslik: string; aciklama?: string; simge: SimgeAdi; href: string; ek?: string; ozellikAnahtari?: string };

/**
 * Lacivert kategori/modül kartları (Mert'in category-tile'ı). Kart bir bağlantıdır; özellik anahtarı verilirse
 * durumu (kırmızı "Geliştiriliyor") kartın içinde görünür. `data-modul` testler ve gezinme için kartın anahtarıdır.
 */
export function Kartlar({ kartlar, etiket, buyuk = false }: { kartlar: Kart[]; etiket: string; buyuk?: boolean }) {
  return (
    <nav aria-label={etiket}>
      <ul className={buyuk ? 'kart-izgara buyuk' : 'kart-izgara'}>
        {kartlar.map((c) => (
          <li key={c.anahtar}>
            <Link className="kategori-karti" href={c.href} data-modul={c.anahtar}>
              <span className="kart-simge">
                <Simge ad={c.simge} />
              </span>
              <span className="kart-metin">
                <b>{c.baslik}</b>
                {c.aciklama ? <small>{c.aciklama}</small> : null}
                {c.ek ? <em>{c.ek}</em> : null}
                {c.ozellikAnahtari ? <FeatureBadge k={c.ozellikAnahtari} /> : null}
              </span>
              <span className="kart-ok">
                <Simge ad="right" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Henüz uygulanmamış sayfa/modül: tüm işlemleri durumlarıyla listelenir (06 §8.3). */
export function Gelistiriliyor({ k }: { k: string }) {
  const islemler = altlar(k).flatMap((a) => (ozellik(a)?.kind === 'action' ? [a] : altlar(a)));
  return (
    <section>
      <Baslik k={k} alt="Bu bölüm yeni yapıda henüz geliştiriliyor. İşlemler kabul testleri yeşil olunca açılır." />
      <ul className="islem-listesi">
        {islemler.map((a) => (
          <li key={a}>
            <span>{ozellik(a)?.title}</span> <code>{a}</code> <FeatureBadge k={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Yasak() {
  return (
    <section className="kart yasak">
      <h1>Yetkiniz yok</h1>
      <p>Bu sayfayı görüntüleme yetkiniz bulunmuyor. Gerekirse ofis yöneticinizden yetki isteyin.</p>
      <Link className="dugme ikincil" href="/">
        <Simge ad="left" />
        Ana sayfaya dön
      </Link>
    </section>
  );
}
