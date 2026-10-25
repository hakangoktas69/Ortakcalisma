import { FeatureBadge } from './FeatureBadge.tsx';
import { altlar, ozellik } from './ozellik.ts';

export function Baslik({ k, alt, children }: { k: string; alt?: string; children?: React.ReactNode }) {
  return (
    <div className="baslik">
      <div>
        <h1>
          {ozellik(k)?.title} <FeatureBadge k={k} />
        </h1>
        {alt ? <p className="alt">{alt}</p> : null}
      </div>
      {children ? <div className="eylemler">{children}</div> : null}
    </div>
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
    <section className="kart">
      <h1>Yetkiniz yok</h1>
      <p>Bu sayfayı görüntüleme yetkiniz bulunmuyor. Gerekirse ofis yöneticinizden yetki isteyin.</p>
    </section>
  );
}
