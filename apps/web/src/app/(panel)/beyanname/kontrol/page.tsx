import Link from 'next/link';
import { controlMatrix, listDeclarations, periodLabel, recentPeriods } from '@eworks/tax-filing';
import { bugun, sozlesmeliFirmalar } from '@/bff/beyanname.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// e-Beyanname kontrol (beyanname.kontrol): sözleşmeli mükellef × son 6 vergilendirme dönemi; hücrede verilen beyanname türleri.
// Kaydı olmayan dönem "—": ya verilmemiş ya da o ay henüz senkronlanmamış (eski portal: "Kontrol edilmedi").
export default async function BeyannameKontrol() {
  const { oturum, izinli } = await sayfaIzni('beyanname.kontrol.view');
  if (!izinli) return <Yasak />;
  const ctx = baglam(oturum);
  const k = konteyner();
  const donemler = recentPeriods(bugun(), 6);
  const [satirlar, { uygun }] = await Promise.all([listDeclarations(ctx, { limit: 5000 }, k.beyannameler), sozlesmeliFirmalar(ctx)]);
  const matris = new Map(controlMatrix(satirlar, donemler).map((r) => [r.firmId, r]));
  const firmalar = [...uygun.values()].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  return (
    <>
      <Baslik k="beyanname.kontrol" alt="Sözleşmeli mükelleflerin son altı dönemde verilen beyannameleri. Boş hücre: kayıt yok ya da o ay senkronlanmadı." />
      <div className="tablo-kap">
        <table className="kontrol">
          <caption className="gorunmez">e-Beyanname kontrol</caption>
          <thead>
            <tr>
              <th>Mükellef</th>
              {donemler.map((d) => (
                <th key={d}>{periodLabel(d, d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firmalar.length === 0 ? (
              <tr>
                <td colSpan={donemler.length + 1}>Sözleşmeli mükellef yok.</td>
              </tr>
            ) : (
              firmalar.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/beyanname/liste?q=${f.taxId}`}>{f.ad}</Link>
                  </td>
                  {donemler.map((d) => {
                    const turler = matris.get(f.id)?.cells[d]?.types ?? [];
                    return (
                      <td key={d} data-donem={d}>
                        {turler.length ? <span className="etiket iyi">{turler.join(', ')}</span> : <span className="soluk">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
