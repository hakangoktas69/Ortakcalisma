import { PORTAL_GROUPS, PORTAL_LINKS } from '@eworks/workspace';
import { sayfaIzni } from '@/bff/oturum.ts';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// Portal kısayolları (kisayollar): GİB ve SGK'nın resmî giriş sayfaları yeni sekmede açılır. Eworks bu sayfalara kurum
// şifresi ya da oturum aktarmaz; giriş kurum sayfasında kullanıcının kendi bilgileriyle yapılır.
export default async function Kisayollar() {
  const { izinli } = await sayfaIzni('kisayollar.view');
  if (!izinli) return <Yasak />;
  return (
    <>
      <Baslik k="kisayollar" alt="Kurumların resmî giriş sayfaları. Eworks kurum şifrelerini bu sayfalara aktarmaz; giriş kurum sayfasında yapılır." />
      {PORTAL_GROUPS.map((g) => (
        <section key={g.id} className="kisayol-grubu" aria-labelledby={`grup-${g.id}`}>
          <h2 id={`grup-${g.id}`}>{g.title}</h2>
          <ul className="kisayollar-listesi">
            {PORTAL_LINKS.filter((l) => l.group === g.id).map((l) => (
              <li key={l.id} className="kart kisayol">
                <h3>{l.title}</h3>
                <p className="alt">{l.description}</p>
                <a className="dugme ikincil" href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.title} sayfasını aç
                  <span className="gorunmez"> (yeni sekmede açılır)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
