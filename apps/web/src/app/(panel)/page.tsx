import Link from 'next/link';
import { accountStatuses } from '@eworks/credentials';
import { isAllowed, type Session } from '@eworks/identity-access';
import { isApproved, listFirms } from '@eworks/portfolio';
import { listFilings } from '@eworks/social-security';
import { latestJobs, STATUS_LABEL, type JobKind } from '@eworks/sync';
import { listDeclarations, recentPeriods } from '@eworks/tax-filing';
import { listTasks, taskCounters, upcomingReminders } from '@eworks/workspace';
import { bugun } from '@/bff/beyanname.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { gorunurKategoriler, kategoriYolu } from '@/shared/ui/kategoriler.ts';
import { gorunur } from '@/shared/ui/ozellik.ts';
import { Kartlar } from '@/shared/ui/Sayfa.tsx';

// Ana sayfa: kategori kartları (Mert'in Eworks tasarımı; yalnız görebildiği modülü olan kategori) ve genel_bakis.panel —
// ofisin günlük durumu; her sayaç kullanıcının yetkisi ve firma kapsamıyla (RLS) hesaplanır. Sayaç bir ekrana bağlıdır;
// yetkisi olmayan sayaç gösterilmez, ana sayfa yetkisi yoksa yalnız kartlar görünür.

type Sayac = { etiket: string; deger: number | string; href: string; uyari?: boolean };

const IS_ADI: Record<JobKind, string> = { 'gib.sozlesmeler': 'GİB sözleşmeleri', 'gib.beyannameler': 'e-Beyanname', 'gib.muhsgk': 'SGK bildirimleri', 'takvim.kaynaklar': 'Takvim kaynakları' };
const IS_SAYFASI: Record<JobKind, string> = { 'gib.sozlesmeler': '/firmalar/gib_sozlesmeler', 'gib.beyannameler': '/beyanname/senkron', 'gib.muhsgk': '/sgk/ebildirge', 'takvim.kaynaklar': '/genel_bakis/takvim' };
const IS_YETKISI: Record<JobKind, string> = { 'gib.sozlesmeler': 'firmalar.gib_sozlesmeler.view', 'gib.beyannameler': 'beyanname.liste.view', 'gib.muhsgk': 'sgk.ebildirge.view', 'takvim.kaynaklar': 'genel_bakis.takvim.sync' };

/** Kategori kartları: gezinmedir, içerik göstermez; ana sayfa yetkisi kapatılmış kullanıcı da izinli modüllerine buradan ulaşır. */
function Merkez({ oturum }: { oturum: Session }) {
  return (
    <>
      <div className="hub-baslik">
        <p className="hub-ust">Eworks çalışma alanı</p>
        <h1>İşlerinizi tek merkezden yönetin</h1>
        <p>Başlamak için bir bölüm seçin.</p>
      </div>
      <Kartlar
        etiket="Kategoriler"
        buyuk
        kartlar={gorunurKategoriler((k) => gorunur(oturum, k)).map((c) => ({
          anahtar: c.id,
          baslik: c.baslik,
          aciklama: c.aciklama,
          simge: c.simge,
          href: kategoriYolu(c),
          ...(c.hedef ? { ozellikAnahtari: c.hedef } : {}),
        }))}
      />
    </>
  );
}

export default async function AnaSayfa() {
  const { oturum, izinli } = await sayfaIzni('genel_bakis.panel.view');
  if (!izinli) return <Merkez oturum={oturum} />;
  const ctx = baglam(oturum);
  const k = konteyner();
  const can = (key: string) => isAllowed(oturum.grants, key);
  const gun = bugun();
  const sonDonem = recentPeriods(gun, 1)[0]!;
  const sayaclar: Sayac[] = [];

  const [firmalar, gorevler, beyannameler, sgk, hesaplar, hatirlatmalar] = await Promise.all([
    can('firmalar.liste.view') ? listFirms(ctx, {}, k.firmalar) : null,
    can('gorevler.view') ? listTasks(ctx, k.gorevler) : null,
    can('beyanname.liste.view') ? listDeclarations(ctx, { limit: 5000 }, k.beyannameler) : null,
    can('sgk.ebildirge.view') ? listFilings(ctx, { limit: 5000 }, k.sgk) : null,
    can('firmalar.kurum_hesaplari.view_status') ? accountStatuses(ctx, k.kurumHesaplari) : null,
    can('genel_bakis.takvim.remind') ? upcomingReminders(ctx, gun, k.hatirlatmalar) : null,
  ]);
  // Uygulama içi hatırlatma (takvim): uyarı zamanı gelmiş kişisel hatırlatmalar
  if (hatirlatmalar) sayaclar.push({ etiket: 'Yaklaşan hatırlatma', deger: hatirlatmalar.length, href: '/genel_bakis/takvim', uyari: hatirlatmalar.length > 0 });
  if (firmalar) {
    sayaclar.push({ etiket: 'Firma', deger: firmalar.length, href: '/firmalar/liste' });
    const bekleyen = firmalar.filter((f) => !isApproved(f.status)).length;
    sayaclar.push({ etiket: 'Onay bekleyen firma', deger: bekleyen, href: '/firmalar/liste?segment=pending', uyari: bekleyen > 0 });
  }
  if (gorevler) {
    const g = taskCounters(gorevler, gun, ctx.sub);
    sayaclar.push({ etiket: 'Açık görev', deger: g.acik, href: '/gorevler' });
    sayaclar.push({ etiket: 'Bana atanan', deger: g.bana, href: '/gorevler?bana=1' });
    sayaclar.push({ etiket: 'Geciken görev', deger: g.geciken, href: '/gorevler', uyari: g.geciken > 0 });
  }
  if (beyannameler) {
    sayaclar.push({ etiket: `Beyanname (${sonDonem.slice(5)}/${sonDonem.slice(0, 4)} dönemi)`, deger: beyannameler.filter((b) => b.periodStart === sonDonem).length, href: '/beyanname/kontrol' });
  }
  if (sgk) {
    const donem = sgk.filter((s) => s.period === sonDonem);
    const bilinmeyen = donem.some((s) => s.employeeCount === null);
    sayaclar.push({ etiket: `SGK çalışan (${sonDonem.slice(5)}/${sonDonem.slice(0, 4)})`, deger: bilinmeyen ? '?' : donem.reduce((t, s) => t + (s.employeeCount ?? 0), 0), href: '/sgk/kontrol' });
  }
  if (hesaplar) {
    const hatali = hesaplar.filter((h) => h.status !== 'active').length;
    sayaclar.push({ etiket: 'Sorunlu kurum hesabı', deger: hatali, href: '/firmalar/kurum_hesaplari', uyari: hatali > 0 });
  }
  const turler = (Object.keys(IS_ADI) as JobKind[]).filter((t) => can(IS_YETKISI[t]));
  const isler = (await Promise.all(turler.map((t) => latestJobs(ctx, t, k.isler, 1)))).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <Merkez oturum={oturum} />
      <h2 className="bolum-basligi">Bugünkü durum</h2>
      <p className="alt">Sayaçlar yetkiniz ve firma kapsamınızla hesaplanır.</p>
      <div className="sayaclar">
        {sayaclar.map((s) => (
          <Link key={s.etiket} className="sayac" href={s.href} data-uyari={s.uyari ? 'true' : undefined}>
            <strong>{s.deger}</strong>
            <span>{s.etiket}</span>
          </Link>
        ))}
      </div>
      {isler.length ? (
        <section className="kart" aria-labelledby="son-isler">
          <h2 id="son-isler">Son kurum işleri</h2>
          <ul className="islem-listesi">
            {isler.map((j) => (
              <li key={j.id}>
                <Link href={IS_SAYFASI[j.kind]}>{IS_ADI[j.kind]}</Link>{' '}
                <span className={`etiket ${j.status === 'succeeded' ? 'iyi' : j.status === 'failed' || j.status === 'wrong_password' ? 'kotu' : 'bekliyor'}`}>{STATUS_LABEL[j.status]}</span>{' '}
                <span className="alt">{new Date(j.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
