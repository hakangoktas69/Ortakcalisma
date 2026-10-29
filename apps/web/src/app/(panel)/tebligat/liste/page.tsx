import Link from 'next/link';
import { hasActiveConsent } from '@eworks/credentials';
import { isAllowed } from '@eworks/identity-access';
import { listNotices, noticeStatusLabel } from '@eworks/notices';
import { listFirms } from '@eworks/portfolio';
import { latestJobs } from '@eworks/sync';
import { isGorunumu } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { TebligatGuncelle } from '@/features/sync/TebligatGuncelle.tsx';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';
import { TabloKap } from '@/shared/ui/TabloKap.tsx';

// e-Tebligat listesi (tebligat.liste; D45): firmanın kendi GİB hesabıyla, mükellef onayıyla okunan liste bilgisi. Belgeler açılmaz
// (belgeyi açmak tebliğ sonucu doğurabilir); okuma tarihinin olmaması "tebliğ edilmedi" anlamına gelmez.
const tr = (t: string | null) => (t ? t.split('-').reverse().join('.') : '—');

export default async function TebligatListesi({ searchParams }: { searchParams: Promise<{ firma?: string }> }) {
  const { oturum, izinli } = await sayfaIzni('tebligat.liste.view');
  if (!izinli) return <Yasak />;
  const a = await searchParams;
  const ctx = baglam(oturum);
  const k = konteyner();
  const firmalar = await listFirms(ctx, {}, k.firmalar);
  const secili = firmalar.find((f) => f.id === a.firma);
  const gunceller = isAllowed(oturum.grants, 'tebligat.liste.sync');
  const [kayitlar, onay, sonIs] = await Promise.all([
    listNotices(ctx, secili ? { firmId: secili.id } : {}, k.tebligat),
    secili && gunceller ? hasActiveConsent(ctx, secili.id, k.onaylar) : Promise.resolve(false),
    secili && gunceller ? latestJobs(ctx, 'gib.etebligat', k.isler, 1) : Promise.resolve([]),
  ]);
  return (
    <>
      <Baslik k="tebligat.liste" alt="Firmanın kendi GİB hesabıyla okunan e-Tebligat listesi. Belgeler açılmaz; okuma tarihinin olmaması tebliğ edilmediği anlamına gelmez." />
      <form className="filtre" method="get">
        <label>
          Mükellef
          <select name="firma" defaultValue={secili?.id ?? ''}>
            <option value="">Tümü</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="dugme ikincil">
          Göster
        </button>
      </form>
      {secili && gunceller ? (
        <section className="kart" aria-label="e-Tebligat güncelleme">
          {onay ? (
            <FeatureGate k="tebligat.liste.sync">
              <TebligatGuncelle csrf={oturum.csrf} firmaId={secili.id} ilk={sonIs[0] ? isGorunumu(sonIs[0]) : null} />
            </FeatureGate>
          ) : (
            <p className="uyari">
              Bu firmanın kurum hesabını kullanmak için önce <Link href={`/firmalar/kart/${secili.id}`}>firma kartında</Link> mükellef onayını kaydedin.
            </p>
          )}
          <p className="alt">Yalnız gözlenen liste süzgecindeki kayıtlar alınır; arşiv ve diğer kutular kapsamda değildir.</p>
        </section>
      ) : null}
      <TabloKap etiket="e-Tebligat listesi">
        <table>
          <caption className="gorunmez">e-Tebligat listesi</caption>
          <thead>
            <tr>
              <th>Firma</th>
              <th>Belge no</th>
              <th>Belge türü</th>
              <th>Gönderen</th>
              <th>Gönderim</th>
              <th>Tebliğ</th>
              <th>Okuma</th>
            </tr>
          </thead>
          <tbody>
            {kayitlar.length === 0 ? (
              <tr>
                <td colSpan={7}>Kayıt yok.</td>
              </tr>
            ) : (
              kayitlar.map((n) => (
                <tr key={n.id}>
                  <td>{n.firmTitle ?? '—'}</td>
                  <td>{n.reference}</td>
                  <td>{n.documentType}</td>
                  <td className="tek-satir">
                    {n.sender}
                    {n.department ? <span className="alt"> · {n.department}</span> : null}
                  </td>
                  <td>{tr(n.sentOn)}</td>
                  <td>{tr(n.deliveredOn)}</td>
                  <td>
                    <span className={`etiket ${n.readOn ? 'iyi' : ''}`}>{noticeStatusLabel(n)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabloKap>
      <p className="alt">{kayitlar.length} kayıt listeleniyor.</p>
    </>
  );
}
