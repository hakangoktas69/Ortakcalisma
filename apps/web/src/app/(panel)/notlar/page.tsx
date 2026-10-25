import Link from 'next/link';
import { isAllowed } from '@eworks/identity-access';
import { listFirms } from '@eworks/portfolio';
import { listNotes } from '@eworks/workspace';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { NotFormu } from '@/features/workspace/Gorevler.tsx';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// Notlar (notlar): mükellefe bağlı ofis içi notlar; eklenir, değiştirilmez. Firma kapsamı RLS'te.
type Ara = { firma?: string };

export default async function Notlar({ searchParams }: { searchParams: Promise<Ara> }) {
  const { oturum, izinli } = await sayfaIzni('notlar.view');
  if (!izinli) return <Yasak />;
  const a = await searchParams;
  const ctx = baglam(oturum);
  const k = konteyner();
  const firmaId = /^[0-9a-f-]{36}$/.test(a.firma ?? '') ? a.firma : undefined;
  const [notlar, firmalar, uyeler] = await Promise.all([listNotes(ctx, k.notlar, firmaId), listFirms(ctx, {}, k.firmalar), k.members.staff(ctx.org, ctx.sub)]);
  const ad = new Map(uyeler.map((u) => [u.userId, u.displayName]));
  return (
    <>
      <Baslik k="notlar" alt="Mükellefe bağlı ofis içi notlar. Notlar değiştirilmez; kim, ne zaman yazdı görünür." />
      {isAllowed(oturum.grants, 'notlar.create') ? (
        <FeatureGate k="notlar.create">
          <NotFormu csrf={oturum.csrf} firmalar={firmalar.map((f) => ({ id: f.id, ad: f.title }))} />
        </FeatureGate>
      ) : null}
      <form className="filtre" method="get">
        <label>
          Mükellef
          <select name="firma" defaultValue={firmaId ?? ''}>
            <option value="">Tümü</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="dugme ikincil">
          Süz
        </button>
      </form>
      <ul className="notlar" aria-label="Notlar">
        {notlar.length === 0 ? <li className="kart">Not yok.</li> : null}
        {notlar.map((n) => (
          <li key={n.id} className="kart">
            <p className="alt">
              <Link href={`/firmalar/kart/${n.firmId}`}>{n.firmTitle}</Link> · {ad.get(n.authorId) ?? 'Kullanıcı'} ·{' '}
              {new Date(n.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}
            </p>
            <p className="not-metni">{n.body}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
