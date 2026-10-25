import Link from 'next/link';
import { isAllowed } from '@eworks/identity-access';
import { listFirms } from '@eworks/portfolio';
import { isOverdue, listTasks, taskCounters, TASK_STATUSES } from '@eworks/workspace';
import { bugun } from '@/bff/beyanname.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { GorevFormu, GorevIslemleri } from '@/features/workspace/Gorevler.tsx';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// Görevler (gorevler): eski portalın "Takvim ve Görevler" ekranı — sayaçlar, süzgeç, görev listesi, yeni görev, durum ve atama.
type Ara = { q?: string; durum?: string; bana?: string };

export default async function Gorevler({ searchParams }: { searchParams: Promise<Ara> }) {
  const { oturum, izinli } = await sayfaIzni('gorevler.view');
  if (!izinli) return <Yasak />;
  const a = await searchParams;
  const ctx = baglam(oturum);
  const k = konteyner();
  const [gorevler, firmalar, uyeler] = await Promise.all([listTasks(ctx, k.gorevler), listFirms(ctx, {}, k.firmalar), k.members.staff(ctx.org, ctx.sub)]);
  const gun = bugun();
  const sayac = taskCounters(gorevler, gun, ctx.sub);
  const ad = new Map(uyeler.map((u) => [u.userId, u.displayName]));
  const q = (a.q ?? '').toLocaleLowerCase('tr-TR');
  const gorunen = gorevler.filter(
    (g) =>
      (!a.durum || g.status === a.durum) &&
      (a.bana !== '1' || g.assigneeId === ctx.sub) &&
      (!q || `${g.title} ${g.firmTitle ?? ''}`.toLocaleLowerCase('tr-TR').includes(q)),
  );
  const izin = { degistir: isAllowed(oturum.grants, 'gorevler.create'), kapat: isAllowed(oturum.grants, 'gorevler.close'), ata: isAllowed(oturum.grants, 'gorevler.assign') };
  const uyeSecenek = uyeler.map((u) => ({ id: u.userId, ad: u.displayName }));
  return (
    <>
      <Baslik k="gorevler" alt="Yasal tarihlerinizi, mükellef işlerini ve sorumlulukları planlayın." />
      <div className="sayaclar">
        {(
          [
            ['Açık görev', sayac.acik, '/gorevler'],
            ['Bana atanan', sayac.bana, '/gorevler?bana=1'],
            ['Öncelikli', sayac.oncelikli, '/gorevler?durum=%C3%96ncelikli'],
            ['Geciken', sayac.geciken, '/gorevler'],
            ['Tamamlanan', sayac.tamamlanan, '/gorevler?durum=Tamamland%C4%B1'],
          ] as const
        ).map(([etiket, n, href]) => (
          <Link key={etiket} className="sayac" href={href}>
            <strong>{n}</strong>
            <span>{etiket}</span>
          </Link>
        ))}
      </div>
      {izin.degistir ? (
        <FeatureGate k="gorevler.create">
          <GorevFormu
            csrf={oturum.csrf}
            firmalar={firmalar.map((f) => ({ id: f.id, ad: f.title }))}
            uyeler={uyeSecenek}
            ben={ctx.sub}
            atayabilir={izin.ata}
            bugun={gun}
          />
        </FeatureGate>
      ) : null}
      <form className="filtre" method="get">
        <label>
          Ara
          <input name="q" type="search" defaultValue={a.q ?? ''} placeholder="Görev veya firma ara…" />
        </label>
        <label>
          Durum
          <select name="durum" defaultValue={a.durum ?? ''}>
            <option value="">Tüm durumlar</option>
            {TASK_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="dugme ikincil">
          Süz
        </button>
      </form>
      <div className="tablo-kap">
        <table>
          <caption className="gorunmez">Görevler</caption>
          <thead>
            <tr>
              <th>Görev</th>
              <th>Mükellef</th>
              <th>Son tarih</th>
              <th>Sorumlu</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {gorunen.length === 0 ? (
              <tr>
                <td colSpan={5}>Görev yok.</td>
              </tr>
            ) : (
              gorunen.map((g) => (
                <tr key={g.id}>
                  <td>{g.title}</td>
                  <td>{g.firmId ? <Link href={`/firmalar/kart/${g.firmId}`}>{g.firmTitle}</Link> : 'Ofis geneli'}</td>
                  <td>
                    {new Date(`${g.dueOn}T12:00:00Z`).toLocaleDateString('tr-TR')}
                    {isOverdue(g, gun) ? <span className="etiket kotu"> Gecikti</span> : null}
                  </td>
                  <td>{g.assigneeId ? (ad.get(g.assigneeId) ?? '—') : 'Atanmamış'}</td>
                  <td>
                    <GorevIslemleri csrf={oturum.csrf} id={g.id} version={g.version} durum={g.status} sorumlu={g.assigneeId} uyeler={uyeSecenek} izin={izin} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="alt">{gorunen.length} görev listeleniyor.</p>
    </>
  );
}
