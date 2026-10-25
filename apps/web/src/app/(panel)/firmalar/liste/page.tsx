import Link from 'next/link';
import { accountStatuses, statusLabel } from '@eworks/credentials';
import { isAllowed } from '@eworks/identity-access';
import { FIRM_KINDS, FIRM_STATUSES, firmCategory, isApproved, listFirms, type Segment } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// Firmalarım (firmalar.liste): eski portalın firma listesi — sayaçlar, süzgeçler, CSV, GİB hesabı durumu.
const SEGMENTLER: [Segment, string][] = [
  ['all', 'Toplam'],
  ['approved', 'Onaylanmış'],
  ['pending', 'Onay bekleyen'],
  ['simple', 'Basit usul'],
  ['corporate', 'Kurumsal'],
  ['personal', 'Şahıs'],
];

type Ara = { q?: string; durum?: string; tur?: string; segment?: string; ok?: string };

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
  const gib = (id: string) => hesaplar.find((h) => h.ownerKind === 'firm' && h.ownerId === id && h.institution === 'GIB');
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
        <label>
          Ara
          <input name="q" type="search" defaultValue={a.q ?? ''} placeholder="Unvan, VKN/TCKN, il, grup…" />
        </label>
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
      <div className="tablo-kap">
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
              <th>GİB hesabı</th>
            </tr>
          </thead>
          <tbody>
            {firmalar.length === 0 ? (
              <tr>
                <td colSpan={7}>Kayıt bulunamadı.</td>
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
                    <span className={`etiket ${gib(f.id)?.status === 'active' ? 'iyi' : gib(f.id) ? 'kotu' : ''}`}>{statusLabel(gib(f.id))}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="alt">{firmalar.length} kayıt listeleniyor.</p>
    </>
  );
}
