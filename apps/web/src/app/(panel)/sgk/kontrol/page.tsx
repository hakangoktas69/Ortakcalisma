import Link from 'next/link';
import { listFilings, sgkControl } from '@eworks/social-security';
import { periodLabel, recentPeriods } from '@eworks/tax-filing';
import { bugun } from '@/bff/beyanname.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// SGK kontrol listesi (sgk.kontrol): mükellef × son 6 dönem; hücrede işyeri sayısı, toplam çalışan, onay bekleyen bildirim.
export default async function SgkKontrol() {
  const { oturum, izinli } = await sayfaIzni('sgk.kontrol.view');
  if (!izinli) return <Yasak />;
  const donemler = recentPeriods(bugun(), 6);
  const satirlar = sgkControl(await listFilings(baglam(oturum), { limit: 5000 }, konteyner().sgk), donemler);
  return (
    <>
      <Baslik k="sgk.kontrol" alt="Son altı dönemin SGK bildirimleri: işyeri sayısı ve çalışan sayısı. Boş hücre: bildirim yok ya da o ay senkronlanmadı." />
      <div className="tablo-kap">
        <table className="kontrol">
          <caption className="gorunmez">SGK kontrol listesi</caption>
          <thead>
            <tr>
              <th>Mükellef</th>
              {donemler.map((d) => (
                <th key={d}>{periodLabel(d, d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {satirlar.length === 0 ? (
              <tr>
                <td colSpan={donemler.length + 1}>Kayıt bulunamadı.</td>
              </tr>
            ) : (
              satirlar.map((r) => (
                <tr key={r.firmId}>
                  <td>
                    <Link href={`/firmalar/kart/${r.firmId}`}>{r.firmTitle}</Link>
                  </td>
                  {donemler.map((d) => {
                    const c = r.cells[d];
                    return (
                      <td key={d} data-donem={d}>
                        {c ? (
                          <span className={`etiket ${c.pending ? 'bekliyor' : 'iyi'}`} title={`${c.workplaces} işyeri`}>
                            {c.employees ?? '?'} çalışan
                          </span>
                        ) : (
                          <span className="soluk">—</span>
                        )}
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
