import Link from 'next/link';
import { statusLabel } from '@eworks/credentials';
import { isAllowed } from '@eworks/identity-access';
import { latestJobs } from '@eworks/sync';
import { isIntermediaryContract, listFilingContracts } from '@eworks/tax-filing';
import { isGorunumu, musavirGibHesabi } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { KurumIsi } from '@/features/sync/KurumIsi.tsx';
import { FeatureBadge, FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';
import { TabloKap } from '@/shared/ui/TabloKap.tsx';

// GİB e-Beyanname sözleşmeleri (firmalar.gib_sozlesmeler): eski portalın "GİB'den güncelle" akışı. Liste müşavirin GİB
// hesabıyla robotla okunur; yeni mükellefler için firma kartı açılır, mevcutlar eşleşir. Kaynaktan kalkan kayıt silinmez.
export default async function GibSozlesmeleri() {
  const { oturum, izinli } = await sayfaIzni('firmalar.gib_sozlesmeler.view');
  if (!izinli) return <Yasak />;
  const ctx = baglam(oturum);
  const k = konteyner();
  const [sozlesmeler, isler, hesap] = await Promise.all([listFilingContracts(ctx, k.sozlesmeler), latestJobs(ctx, 'gib.sozlesmeler', k.isler, 1), musavirGibHesabi(ctx)]);
  const son = isler[0];
  const mukellef = new Set(sozlesmeler.map((s) => s.firmId)).size;
  const sahte = sozlesmeler.some((s) => s.source === 'sahte_gib');
  const baslatabilir = isAllowed(oturum.grants, 'firmalar.gib_sozlesmeler.sync');
  const gruplar = new Map<string, { firmId: string; ad: string; turler: string[]; uygun: boolean }>();
  for (const s of sozlesmeler) {
    const g = gruplar.get(s.firmId) ?? { firmId: s.firmId, ad: s.firmTitle, turler: [], uygun: false };
    if (s.contractType && !g.turler.includes(s.contractType)) g.turler.push(s.contractType);
    g.uygun ||= isIntermediaryContract(s.contractType);
    gruplar.set(s.firmId, g);
  }
  const inceleme = [...gruplar.values()].sort((a, b) => Number(a.uygun) - Number(b.uygun) || a.ad.localeCompare(b.ad, 'tr'));
  return (
    <>
      <Baslik k="firmalar.gib_sozlesmeler" alt="GİB'deki geçerli e-Beyanname sözleşmeleriniz; yeni mükellefler firma listesine otomatik eklenir." />
      <section className="kart">
        <p>
          Müşavir GİB hesabınız:{' '}
          <span className={`etiket ${hesap?.status === 'active' ? 'iyi' : hesap ? 'kotu' : ''}`}>
            {statusLabel(hesap ?? undefined)}
          </span>{' '}
          <Link href="/firmalar/kurum_hesaplari">Kurum hesapları</Link>
        </p>
        <FeatureGate k="firmalar.gib_sozlesmeler.sync">
          <KurumIsi
            csrf={oturum.csrf}
            uc="/api/sync/gib-sozlesmeler"
            dugme="GİB'den güncelle"
            ilk={son ? isGorunumu(son) : null}
            baslatabilir={baslatabilir}
          />
        </FeatureGate>
        {sahte ? <p className="uyari">Bu ortamdaki liste sahte GİB sunucusundan (demo) okundu; gerçek mükellef verisi değildir.</p> : null}
      </section>
      <div className="sayaclar">
        <div className="sayac">
          <strong>{sozlesmeler.length}</strong>
          <span>Sözleşme</span>
        </div>
        <div className="sayac">
          <strong>{mukellef}</strong>
          <span>Mükellef</span>
        </div>
        <div className="sayac">
          <strong>{sozlesmeler.filter((s) => isIntermediaryContract(s.contractType)).length}</strong>
          <span>Aracılık ve Sorumluluk</span>
        </div>
      </div>
      {isAllowed(oturum.grants, 'firmalar.gib_sozlesmeler.review') && inceleme.length ? (
        <section className="kart" aria-labelledby="inceleme">
          <h2 id="inceleme">
            Kurum incelemesi <FeatureBadge k="firmalar.gib_sozlesmeler.review" />
          </h2>
          <p className="alt">Beyanname yalnız geçerli Aracılık ve Sorumluluk sözleşmesi olan mükellef için, aynı GİB oturumunda okunan sözleşmeyle kanıtlanarak sorgulanır.</p>
          <TabloKap etiket="Kurum incelemesi">
            <table>
              <caption className="gorunmez">Beyanname erişimi</caption>
              <thead>
                <tr>
                  <th>Mükellef</th>
                  <th>Sözleşme türleri</th>
                  <th>Beyanname erişimi</th>
                </tr>
              </thead>
              <tbody>
                {inceleme.map((m) => (
                  <tr key={m.firmId}>
                    <td>{m.ad}</td>
                    <td>{m.turler.join(', ')}</td>
                    <td>
                      <span className={`etiket ${m.uygun ? 'iyi' : 'kotu'}`}>{m.uygun ? 'Beyanname sorgulanabilir' : 'Sözleşme türü uygun değil'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabloKap>
        </section>
      ) : null}
      <TabloKap etiket="GİB sözleşme listesi">
        <table>
          <caption className="gorunmez">GİB e-Beyanname sözleşmeleri</caption>
          <thead>
            <tr>
              <th>Mükellef</th>
              <th>VKN / TCKN</th>
              <th>Sözleşme no</th>
              <th>Sözleşme tarihi</th>
              <th>Tür</th>
              <th>Vergi dairesi</th>
            </tr>
          </thead>
          <tbody>
            {sozlesmeler.length === 0 ? (
              <tr>
                <td colSpan={6}>Henüz sözleşme yok. Müşavir GİB hesabınızı kaydedip &quot;GİB&apos;den güncelle&quot;yi kullanın.</td>
              </tr>
            ) : (
              sozlesmeler.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/firmalar/kart/${s.firmId}`}>{s.firmTitle}</Link>
                  </td>
                  <td>{s.taxId}</td>
                  <td>{s.number}</td>
                  <td>{s.contractDate ?? '—'}</td>
                  <td>{s.contractType ?? '—'}</td>
                  <td>{s.taxOffice ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabloKap>
    </>
  );
}
