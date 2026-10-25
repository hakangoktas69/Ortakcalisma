import Link from 'next/link';
import { documentsFor, KIND_LABEL } from '@eworks/documents';
import { isAllowed } from '@eworks/identity-access';
import { listFilings, maskWorkplace } from '@eworks/social-security';
import { latestJobs } from '@eworks/sync';
import { periodLabel } from '@eworks/tax-filing';
import { bugun, sozlesmeliFirmalar } from '@/bff/beyanname.ts';
import { isGorunumu } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { BeyannameSenkronFormu } from '@/features/tax-filing/BeyannameSenkronFormu.tsx';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';
import { TabloKap } from '@/shared/ui/TabloKap.tsx';

// e-Bildirge (sgk.ebildirge): MUHSGK beyannamelerinin SGK bildirimleri — işyeri × ay, durum, çalışan sayısı, SGK tahakkuk ve
// hizmet listesi PDF'leri. Kaynak GİB e-Beyanname içindeki SGK bildirimleridir (eski portalın SGK ekranı). Çalışan kimliği tutulmaz.
type Ara = { q?: string; yil?: string };

export default async function EBildirge({ searchParams }: { searchParams: Promise<Ara> }) {
  const { oturum, izinli } = await sayfaIzni('sgk.ebildirge.view');
  if (!izinli) return <Yasak />;
  const a = await searchParams;
  const ctx = baglam(oturum);
  const k = konteyner();
  const yil = /^\d{4}$/.test(a.yil ?? '') ? Number(a.yil) : undefined;
  const satirlar = await listFilings(ctx, { q: a.q ?? '', year: yil }, k.sgk);
  const indirebilir = isAllowed(oturum.grants, 'sgk.ebildirge.download');
  const belgeler = indirebilir ? await documentsFor(ctx, satirlar.map((s) => s.id), k.belgeler) : [];
  const guncelleyebilir = isAllowed(oturum.grants, 'sgk.ebildirge.sync');
  const [{ uygun }, isler] = guncelleyebilir ? await Promise.all([sozlesmeliFirmalar(ctx), latestJobs(ctx, 'gib.muhsgk', k.isler, 1)]) : [{ uygun: new Map() }, []];
  const firmalar = [...uygun.values()].sort((x, y) => x.ad.localeCompare(y.ad, 'tr')).map((f) => ({ id: f.id, ad: `${f.ad} (${f.taxId})` }));
  return (
    <>
      <Baslik k="sgk.ebildirge" alt="MUHSGK beyannamelerinin SGK bildirimleri: işyeri, dönem, durum, çalışan sayısı ve PDF'ler." />
      {guncelleyebilir ? (
        <section className="kart">
          <h2>Toplu güncelle</h2>
          <p className="alt">GİB e-Beyanname üzerinden, müşavir GİB hesabınızla; yalnız Aracılık ve Sorumluluk sözleşmeli mükellefler.</p>
          <FeatureGate k="sgk.ebildirge.sync">
            <BeyannameSenkronFormu
              csrf={oturum.csrf}
              ilk={isler[0] ? isGorunumu(isler[0]) : null}
              firmalar={firmalar}
              varsayilanAy={bugun().slice(0, 7)}
              uc="/api/sync/muhsgk"
              dugme="SGK bildirimlerini güncelle"
            />
          </FeatureGate>
        </section>
      ) : null}
      <form className="filtre" method="get">
        <label>
          Ara
          <input name="q" type="search" defaultValue={a.q ?? ''} placeholder="Unvan, VKN/TCKN" />
        </label>
        <label>
          Dönem yılı
          <input name="yil" inputMode="numeric" pattern="\d{4}" defaultValue={a.yil ?? ''} placeholder="2026" />
        </label>
        <button type="submit" className="dugme ikincil">
          Süz
        </button>
      </form>
      <TabloKap etiket="SGK bildirimleri">
        <table>
          <caption className="gorunmez">SGK bildirimleri</caption>
          <thead>
            <tr>
              <th>Mükellef</th>
              <th>İşyeri</th>
              <th>Dönem</th>
              <th>Durum</th>
              <th>Çalışan</th>
              {indirebilir ? <th>Belgeler</th> : null}
            </tr>
          </thead>
          <tbody>
            {satirlar.length === 0 ? (
              <tr>
                <td colSpan={indirebilir ? 6 : 5}>Kayıt bulunamadı.</td>
              </tr>
            ) : (
              satirlar.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/firmalar/kart/${s.firmId}`}>{s.firmTitle}</Link>
                  </td>
                  <td title="SGK işyeri sicil numarası (kısaltılmış)">{maskWorkplace(s.workplace)}</td>
                  <td>{periodLabel(s.period, s.period)}</td>
                  <td>
                    <span className={`etiket ${s.status === 'Onaylandı' ? 'iyi' : 'bekliyor'}`}>{s.status}</span>
                  </td>
                  <td>{s.employeeCount ?? '—'}</td>
                  {indirebilir ? (
                    <td className="belgeler">
                      {belgeler
                        .filter((b) => b.subjectId === s.id)
                        .map((b) =>
                          b.fileDeletedAt ? (
                            <span key={b.id} className="etiket">
                              {KIND_LABEL[b.kind]} (silindi)
                            </span>
                          ) : (
                            <FeatureGate key={b.id} k="sgk.ebildirge.download">
                              <a href={`/api/belgeler/${b.id}`} download>
                                {KIND_LABEL[b.kind]}
                              </a>
                            </FeatureGate>
                          ),
                        )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabloKap>
      <p className="alt">
        {satirlar.length} kayıt listeleniyor.{satirlar.some((s) => s.source === 'sahte_gib') ? ' Bu ortamdaki kayıtlar sahte GİB sunucusundan (demo).' : ''}
      </p>
    </>
  );
}
