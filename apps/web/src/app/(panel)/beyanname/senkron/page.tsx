import Link from 'next/link';
import { statusLabel } from '@eworks/credentials';
import { isAllowed } from '@eworks/identity-access';
import { latestJobs } from '@eworks/sync';
import { bugun, sozlesmeliFirmalar } from '@/bff/beyanname.ts';
import { isGorunumu, musavirGibHesabi } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { BeyannameSenkronFormu } from '@/features/tax-filing/BeyannameSenkronFormu.tsx';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// Beyanname senkronu (beyanname.senkron): eski portalın "GİB'den beyanname al" akışı. Müşavir GİB hesabıyla, seçilen gönderim
// aylarında e-Beyanname listesi ve PDF'ler (beyanname + tahakkuk) alınır.
export default async function BeyannameSenkronu() {
  const { oturum, izinli } = await sayfaIzni('beyanname.senkron.start');
  if (!izinli) return <Yasak />;
  const ctx = baglam(oturum);
  const k = konteyner();
  const [{ uygun }, isler, hesap] = await Promise.all([sozlesmeliFirmalar(ctx), latestJobs(ctx, 'gib.beyannameler', k.isler, 1), musavirGibHesabi(ctx)]);
  const son = isler[0];
  const firmalar = [...uygun.values()].sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map((f) => ({ id: f.id, ad: `${f.ad} (${f.taxId})` }));
  return (
    <>
      <Baslik k="beyanname.senkron" alt="e-Beyanname listesi ve PDF'leri müşavir GİB hesabınızla, yalnız Aracılık ve Sorumluluk sözleşmeli mükellefler için alınır." />
      <section className="kart">
        <p>
          Müşavir GİB hesabınız: <span className={`etiket ${hesap?.status === 'active' ? 'iyi' : hesap ? 'kotu' : ''}`}>{statusLabel(hesap ?? undefined)}</span>{' '}
          <Link href="/firmalar/kurum_hesaplari">Kurum hesapları</Link> · <Link href="/firmalar/gib_sozlesmeler">GİB sözleşmeleri</Link>
        </p>
        {firmalar.length === 0 ? (
          <p className="uyari">Sözleşmeli mükellef yok. Önce GİB sözleşmeleri ekranından &quot;GİB&apos;den güncelle&quot;yi çalıştırın; senkron sözleşmeleri de yeniden okur.</p>
        ) : null}
        {isAllowed(oturum.grants, 'beyanname.senkron.start') ? (
          <FeatureGate k="beyanname.senkron.start">
            <BeyannameSenkronFormu csrf={oturum.csrf} ilk={son ? isGorunumu(son) : null} firmalar={firmalar} varsayilanAy={bugun().slice(0, 7)} />
          </FeatureGate>
        ) : null}
      </section>
      <p className="alt">
        Sonuçlar: <Link href="/beyanname/liste">e-Beyanname görüntüleme</Link> · <Link href="/beyanname/kontrol">e-Beyanname kontrol</Link> ·{' '}
        <Link href="/beyanname/belge">Beyanname / tahakkuk PDF</Link>. PDF dosyaları saklama süresi dolunca silinir; kayıt kalır.
      </p>
    </>
  );
}
