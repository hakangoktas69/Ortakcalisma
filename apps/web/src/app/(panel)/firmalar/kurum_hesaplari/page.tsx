import Link from 'next/link';
import { accountStatuses, statusLabel } from '@eworks/credentials';
import { isAllowed } from '@eworks/identity-access';
import { listFirms, myAdvisorId } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { KurumHesabiFormu } from '@/features/credentials/KurumHesabiFormu.tsx';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// Kurum hesapları (firmalar.kurum_hesaplari): müşavirin kendi GİB hesabı (sözleşme listesi bununla okunur) + firmaların GİB hesap durumu.
export default async function KurumHesaplari() {
  const { oturum, izinli } = await sayfaIzni('firmalar.kurum_hesaplari.view_status');
  if (!izinli) return <Yasak />;
  const ctx = baglam(oturum);
  const k = konteyner();
  const [firmalar, hesaplar, musavir] = await Promise.all([listFirms(ctx, {}, k.firmalar), accountStatuses(ctx, k.kurumHesaplari), myAdvisorId(ctx, k.firmalar)]);
  const benim = musavir ? hesaplar.find((h) => h.ownerKind === 'advisor' && h.ownerId === musavir && h.institution === 'GIB') : undefined;
  const firmaninki = (id: string) => hesaplar.find((h) => h.ownerKind === 'firm' && h.ownerId === id && h.institution === 'GIB');
  return (
    <>
      <Baslik k="firmalar.kurum_hesaplari" alt="Kurum (GİB) hesapları yalnız Vault'ta saklanır; burada yalnız durumları görünür." />
      {musavir ? (
        <section className="kart">
          <p>
            Müşavir GİB hesabınız: <span className={`etiket ${benim?.status === 'active' ? 'iyi' : benim ? 'kotu' : ''}`}>{statusLabel(benim)}</span>
          </p>
          {isAllowed(oturum.grants, 'firmalar.kurum_hesaplari.edit_credentials') ? (
            <FeatureGate k="firmalar.kurum_hesaplari.edit_credentials">
              <KurumHesabiFormu
                csrf={oturum.csrf}
                sahip="advisor"
                sahipId={musavir}
                baslik="Müşavir GİB hesabı"
                aciklama="E-Beyanname sözleşme listesi bu hesapla okunur. GİB şifrenizi Eworks girişinde kullanmayın."
              />
            </FeatureGate>
          ) : null}
        </section>
      ) : null}
      <div className="tablo-kap">
        <table>
          <caption className="gorunmez">Firmaların GİB hesapları</caption>
          <thead>
            <tr>
              <th>Firma</th>
              <th>GİB hesabı</th>
              <th>Son güncelleme</th>
            </tr>
          </thead>
          <tbody>
            {firmalar.map((f) => {
              const h = firmaninki(f.id);
              return (
                <tr key={f.id}>
                  <td>
                    <Link href={`/firmalar/kart/${f.id}`}>{f.title}</Link>
                  </td>
                  <td>
                    <span className={`etiket ${h?.status === 'active' ? 'iyi' : h ? 'kotu' : ''}`}>{statusLabel(h)}</span>
                  </td>
                  <td>{h ? new Date(h.updatedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
