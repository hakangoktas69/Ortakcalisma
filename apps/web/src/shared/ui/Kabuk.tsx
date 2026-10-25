import Link from 'next/link';
import { isAllowed, type Session } from '@eworks/identity-access';
import { FeatureBadge } from './FeatureBadge.tsx';
import { altlar, menuHedefi, moduller, ozellik, yol } from './ozellik.ts';

// Uygulama kabuğu: yan menü (yalnız yetkili modül/sayfalar, 05 §3.4) + üst bilgi + içerik.
// Dar ekranda menü bir düğmeyle açılır (JS'siz, onay kutusu); modüller açılır gruplardır.

const MENU_DISI = new Set(['oturum', 'satis']);

const gorunur = (s: Session, k: string): boolean => isAllowed(s.grants, k) || altlar(k).some((a) => gorunur(s, a));

export function Kabuk({ oturum, children }: { oturum: Session; children: React.ReactNode }) {
  const menu = moduller().filter((m) => !MENU_DISI.has(m) && gorunur(oturum, m));
  return (
    <div className="kabuk">
      <header className="ust">
        <label htmlFor="menu-ac" className="menu-dugme">
          ☰ Menü
        </label>
        <Link href="/" className="marka">
          Eworks
        </Link>
        <div className="kim">
          <span className="ofis">{oturum.orgName}</span>
          <span className="kisi">{oturum.displayName}</span>
          <form method="post" action="/api/oturum/cikis">
            <input type="hidden" name="csrf" value={oturum.csrf} />
            <button type="submit" className="dugme ikincil">
              Çıkış
            </button>
          </form>
        </div>
      </header>
      <input type="checkbox" id="menu-ac" className="menu-ac" aria-label="Menüyü aç/kapat" />
      <nav className="menu" aria-label="Ana menü">
        <ul>
          {menu.map((m) => {
            const sayfalar = altlar(m).filter((p) => ozellik(p)?.kind === 'page' && gorunur(oturum, p));
            return (
              <li key={m}>
                {sayfalar.length > 1 ? (
                  <details>
                    <summary data-modul={m}>
                      <span>{ozellik(m)?.title}</span>
                      <FeatureBadge k={m} kucuk />
                    </summary>
                    <ul>
                      {sayfalar.map((p) => (
                        <li key={p}>
                          <Link href={yol(p)}>
                            <span>{ozellik(p)?.title}</span>
                            <FeatureBadge k={p} kucuk />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <Link href={yol(menuHedefi(m))} data-modul={m}>
                    <span>{ozellik(m)?.title}</span>
                    <FeatureBadge k={m} kucuk />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="icerik">{children}</main>
    </div>
  );
}
