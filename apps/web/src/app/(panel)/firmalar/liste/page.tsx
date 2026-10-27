import Link from 'next/link';
import { accountStatuses, combineLiveStatus, liveStatus, liveStatusLabel, type LiveStatus } from '@eworks/credentials';
import { isAllowed } from '@eworks/identity-access';
import { FIRM_KINDS, FIRM_STATUSES, firmCategory, isApproved, listFirms, type Segment } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { FirmaArama } from '@/features/portfolio/FirmaArama.tsx';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';
import { TabloKap } from '@/shared/ui/TabloKap.tsx';

// Firmalarım (firmalar.liste): eski portalın firma listesi — sayaçlar, süzgeçler, CSV, kurum durumu (G/S/V), Düzenle.
// G/S/V kutuları yalnız kurumda doğrulanmış girişi "aktif" gösterir (Mert 26.10); vergi levhasının kaynağı henüz yok, gri kalır.
const SEGMENTLER: [Segment, string][] = [
  ['all', 'Toplam'],
  ['approved', 'Onaylanmış'],
  ['pending', 'Onay bekleyen'],
  ['simple', 'Basit usul'],
  ['corporate', 'Kurumsal'],
  ['personal', 'Şahıs'],
];

type Ara = { q?: string; durum?: string; tur?: string; segment?: string; ok?: string };

const SINIF = { active: 'iyi', inactive: 'kotu', unknown: '' } as const;

function DurumKutusu({ harf, ad, durum }: { harf: string; ad: string; durum: LiveStatus }) {
  const metin = liveStatusLabel(durum.state);
  const tarih = durum.checkedAt ? ` · son kontrol ${new Date(durum.checkedAt).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}` : '';
  return (
    <span className={`etiket durum-kutusu ${SINIF[durum.state]}`} data-durum={durum.state} title={`${ad}: ${metin}${tarih}`}>
      <b aria-hidden="true">{harf}</b>
      <span className="gorunmez">{ad}: </span>
      {metin}
      {tarih ? <span className="gorunmez">{tarih}</span> : null}
    </span>
  );
}

export default async function FirmaListesi({ searchParams }: { searchParams: Promise<Ara> }) {
  const { oturum, izinli } = await sayfaIzni('firmalar.liste.view');
  if (!izinli) return <Yasak />;
  const a = await searchParams;
  const segment = (SEGMENTLER.find(([s]) => s === a.segment)?.[0] ?? 'all') as Segment;
  const ctx = baglam(oturum);
  const k = konteyner();
  const tumu = await listFirms(ctx, {}, k.firmalar);
  const firmalar = await listFirms(ctx, { q: a.q ?? '', status: a.durum ?? '', kind: a.tur ?? '', segment }, k.firmalar);
  const hesaplar = await accountStatuses(ctx, k.kurumHesaplari);
  const hesap = (id: string, kurum: 'GIB' | 'SGK') => hesaplar.filter((h) => h.ownerKind === 'firm' && h.ownerId === id && h.institution === kurum);
  const duzenler = isAllowed(oturum.grants, 'firmalar.kart.edit');
  const sorgu = new URLSearchParams(Object.entries({ q: a.q ?? '', durum: a.durum ?? '', tur: a.tur ?? '', segment }).filter(([, v]) => v && v !== 'all'));
  const sayac = (s: Segment) =>
    s === 'all' ? tumu.length : tumu.filter((f) => (s === 'approved' ? isApproved(f.status) : s === 'pending' ? !isApproved(f.status) : s === 'simple' ? f.taxRegime === 'Basit Usul' : firmCategory(f.kind) === s)).length;
  return (
    <>
      <Baslik k="firmalar.liste" alt="Mükelleflerinizi, onay durumlarını ve kurum hesaplarını tek yerden yönetin.">
        {isAllowed(oturum.grants, 'firmalar.liste.export') ? (
          <FeatureGate k="firmalar.liste.export">
            <a className="dugme ikincil" href={`/api/firmalar/csv?${sorgu}`} download>
              CSV indir
            </a>
          </FeatureGate>
        ) : null}
        {isAllowed(oturum.grants, 'firmalar.kart.create') ? (
          <FeatureGate k="firmalar.kart.create">
            <Link className="dugme birincil" href="/firmalar/kart/yeni">
              Yeni firma
            </Link>
          </FeatureGate>
        ) : null}
      </Baslik>
      {a.ok === 'arsivlendi' ? (
        <p className="basari" role="status">
          Firma arşivlendi.
        </p>
      ) : null}
      <div className="sayaclar">
        {SEGMENTLER.map(([s, ad]) => (
          <Link key={s} href={s === 'all' ? '/firmalar/liste' : `/firmalar/liste?segment=${s}`} className="sayac" aria-current={segment === s ? 'true' : undefined}>
            <strong>{sayac(s)}</strong>
            <span>{ad}</span>
          </Link>
        ))}
      </div>
      <form className="filtre" method="get">
        <FirmaArama ilk={a.q ?? ''} />
        <label>
          Onay durumu
          <select name="durum" defaultValue={a.durum ?? ''}>
            <option value="">Tümü</option>
            {FIRM_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Firma türü
          <select name="tur" defaultValue={a.tur ?? ''}>
            <option value="">Tümü</option>
            {FIRM_KINDS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {segment !== 'all' ? <input type="hidden" name="segment" value={segment} /> : null}
        <button type="submit" className="dugme ikincil">
          Süz
        </button>
      </form>
      <p className="alt durum-aciklama">
        Kurum durumu: <span className="etiket iyi">Aktif</span> kurumda son girişle doğrulandı, <span className="etiket kotu">Aktif değil</span> giriş başarısız ya da
        hesap durduruldu, <span className="etiket">Doğrulanmadı</span> henüz kurumda denenmedi. Bilgilerin kayıtlı olması tek başına doğrulama sayılmaz.
      </p>
      <TabloKap etiket="Firma listesi">
        <table>
          <caption className="gorunmez">Firmalar</caption>
          <thead>
            <tr>
              <th>Unvan</th>
              <th>Tür</th>
              <th>VKN / TCKN</th>
              <th>Vergi dairesi</th>
              <th>İl</th>
              <th>Onay</th>
              <th>Kurum durumu</th>
              <th>
                <span className="gorunmez">İşlem</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {firmalar.length === 0 ? (
              <tr>
                <td colSpan={8}>Kayıt bulunamadı.</td>
              </tr>
            ) : (
              firmalar.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/firmalar/kart/${f.id}`}>{f.title}</Link>
                  </td>
                  <td>{f.kind}</td>
                  <td>{f.taxId}</td>
                  <td>{f.taxOffice ?? '—'}</td>
                  <td>{f.city ?? '—'}</td>
                  <td>
                    <span className={`etiket ${isApproved(f.status) ? 'iyi' : f.status === 'Pasif' ? '' : 'bekliyor'}`}>{f.status}</span>
                  </td>
                  <td>
                    <div className="durum-kutulari">
                      <DurumKutusu harf="G" ad="GİB erişimi" durum={liveStatus(hesap(f.id, 'GIB')[0])} />
                      <DurumKutusu harf="S" ad="SGK erişimi" durum={combineLiveStatus(hesap(f.id, 'SGK').map(liveStatus))} />
                      <DurumKutusu harf="Vergi levhası" ad="Vergi levhası" durum={{ state: 'unknown', checkedAt: null }} />
                    </div>
                  </td>
                  <td>
                    <Link className="dugme ikincil kucuk" href={`/firmalar/kart/${f.id}`} aria-label={`${f.title} ${duzenler ? 'düzenle' : 'görüntüle'}`}>
                      {duzenler ? 'Düzenle' : 'Görüntüle'}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TabloKap>
      <p className="alt">{firmalar.length} kayıt listeleniyor.</p>
    </>
  );
}
