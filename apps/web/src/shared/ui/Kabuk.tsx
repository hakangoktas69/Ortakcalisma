import Link from 'next/link';
import { features } from '@eworks/feature-registry';
import type { Session } from '@eworks/identity-access';
import logo from './eworks-logo.png';
import { FeatureBadge } from './FeatureBadge.tsx';
import { KATEGORILER } from './kategoriler.ts';
import { Konum } from './Konum.tsx';
import { gorunur, yol } from './ozellik.ts';
import { Simge } from './Simge.tsx';

// Uygulama kabuğu (Mert'in Eworks tasarımı): üst çubuk (logo, konum, Takvim, Bildirimler, kullanıcı, çıkış) + içerik.
// Yan menü yoktur; gezinme ana sayfadaki kategori kartlarıyla yapılır (yalnız yetkili modül/sayfalar, 05 §3.4).

const MENU_DISI = new Set(['oturum', 'satis', 'genel_bakis']);

/** Modül ve sayfa düğümleri (adres, anahtar, başlık); durağan veriden bir kez kurulur. İşlemler ve menü dışı modüller girmez. */
const DUGUMLER: [string, string, string][] = [
  ...Object.entries(features)
    .filter(([k, f]) => f.kind !== 'action' && !MENU_DISI.has(k.split('.')[0]!))
    .map(([k, f]): [string, string, string] => [yol(k), k, f.title]),
  [yol('genel_bakis.takvim'), 'genel_bakis.takvim', features['genel_bakis.takvim']?.title ?? 'Takvim'],
];

/**
 * Adres → başlık tablosu (üst çubuktaki konum için, istemciye gider). En az yetki: yalnız kullanıcının görebildiği
 * modül/sayfaların başlıkları girer; görmediği bölümün adı tarayıcıya taşınmaz.
 */
const basliklar = (s: Session): Record<string, string> => ({
  ...Object.fromEntries(DUGUMLER.filter(([, k]) => gorunur(s, k)).map(([adres, , baslik]) => [adres, baslik])),
  '/': 'Ana Sayfa',
  ...Object.fromEntries(KATEGORILER.map((k) => [`/kategori/${k.id}`, k.baslik])),
});

const basHarfler = (ad: string) =>
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => Array.from(p)[0]!.toLocaleUpperCase('tr-TR'))
    .join('');

export function Kabuk({ oturum, children }: { oturum: Session; children: React.ReactNode }) {
  const takvim = gorunur(oturum, 'genel_bakis.takvim');
  const bildirim = gorunur(oturum, 'bildirimler');
  return (
    <div className="kabuk">
      <a className="atla" href="#icerik">
        İçeriğe geç
      </a>
      <header className="ust">
        <div className="ust-sol">
          <Link href="/" className="marka" aria-label="Eworks ana sayfa">
            <img src={logo.src} alt="" width={115} height={35} />
          </Link>
          <span className="konum">
            <span className="konum-kok">Eworks /</span>
            <Konum basliklar={basliklar(oturum)} />
          </span>
        </div>
        <div className="ust-sag">
          {takvim || bildirim ? (
            <nav className="kisayollar" aria-label="Kısayollar">
              {takvim ? (
                <Link href={yol('genel_bakis.takvim')} className="ust-dugme">
                  <Simge ad="calendar" />
                  <span className="ust-dugme-metin">Takvim</span>
                  <FeatureBadge k="genel_bakis.takvim" kucuk />
                </Link>
              ) : null}
              {bildirim ? (
                <Link href={yol('bildirimler')} className="ust-dugme">
                  <Simge ad="bell" />
                  <span className="ust-dugme-metin">Bildirimler</span>
                  <FeatureBadge k="bildirimler" kucuk />
                </Link>
              ) : null}
            </nav>
          ) : null}
          <div className="profil">
            <span className="avatar" aria-hidden="true">
              {basHarfler(oturum.displayName)}
            </span>
            <span className="profil-metin">
              <span className="kisi">{oturum.displayName}</span>
              <span className="ofis">{oturum.orgName}</span>
            </span>
          </div>
          <form method="post" action="/api/oturum/cikis">
            <input type="hidden" name="csrf" value={oturum.csrf} />
            <button type="submit" className="dugme ikincil cikis">
              <Simge ad="out" />
              <span className="cikis-metin">Çıkış</span>
            </button>
          </form>
        </div>
      </header>
      <main id="icerik" className="icerik">
        {children}
      </main>
      <footer className="alt-bilgi">© {new Date().getFullYear()} Eworks · Akıllı Muhasebe Çalışma Alanı</footer>
    </div>
  );
}
