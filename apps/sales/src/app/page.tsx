import { ACCOUNT_STATUSES, listOffices, type AccountStatus } from '@eworks/sales';
import { konteyner } from '@/bff/konteyner.ts';
import { satisSayfaIzni } from '@/bff/oturum.ts';
import { Kabuk, Yasak } from '@/shared/ui/Kabuk.tsx';

// Ofis listesi (satis.ofis): bütün ofisler — yetkili, telefon, paket, durum (deneme / aktif / süresi doldu / donduruldu /
// süresiz), lisans bitişi. Mükellef iş verisi yoktur. Arama ve durum süzgeci GET formuyla (adres paylaşılabilir).

const DURUM_ADI: Record<AccountStatus, string> = {
  deneme: 'Deneme',
  aktif: 'Aktif',
  suresi_doldu: 'Süresi doldu',
  donduruldu: 'Donduruldu',
  suresiz: 'Süresiz',
};

const tarih = (d: Date | null) => (d ? d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '—');

const SAYFA_BOYU = 50;

export default async function Ofisler({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string; sayfa?: string }> }) {
  const { oturum, izinli } = await satisSayfaIzni('satis.ofis');
  if (!izinli)
    return (
      <Kabuk ad={oturum.fullName} csrf={oturum.csrf} etkin="ofisler">
        <Yasak />
      </Kabuk>
    );
  const a = await searchParams;
  const q = (a.q ?? '').slice(0, 100);
  const hepsi = await listOffices({ q, ...(a.durum ? { status: a.durum } : {}) }, konteyner().ofisler);
  // Sayfalama (ofis sayısı yüzlerle; liste ekranda 50'şer)
  const sayfaSayisi = Math.max(1, Math.ceil(hepsi.length / SAYFA_BOYU));
  const sayfa = Math.min(sayfaSayisi, Math.max(1, Number.parseInt(a.sayfa ?? '1', 10) || 1));
  const ofisler = hepsi.slice((sayfa - 1) * SAYFA_BOYU, sayfa * SAYFA_BOYU);
  const sayfaAdresi = (n: number) => `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(a.durum ? { durum: a.durum } : {}), sayfa: String(n) }).toString()}`;
  return (
    <Kabuk ad={oturum.fullName} csrf={oturum.csrf} etkin="ofisler">
      <div className="baslik-satir">
        <div>
          <h1>Ofisler</h1>
          <p className="alt">Müşavir ofislerinin hesap ve lisans durumu. Mükellef verisi bu portalda görünmez.</p>
        </div>
        <a className="dugme birincil" href="/yeni">
          Yeni ofis aç
        </a>
      </div>
      <form className="filtre kart" method="get" role="search" aria-label="Ofis ara">
        <label>
          Ara
          <input name="q" type="search" defaultValue={q} maxLength={100} placeholder="Ofis adı, yetkili ya da e-posta" />
        </label>
        <label>
          Durum
          <select name="durum" defaultValue={a.durum ?? ''}>
            <option value="">Tüm durumlar</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DURUM_ADI[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="dugme ikincil">
          Süz
        </button>
      </form>
      <div className="tablo-kap" role="region" aria-label="Ofis listesi" tabIndex={0}>
        <table>
          <caption className="gorunmez">Ofisler</caption>
          <thead>
            <tr>
              <th scope="col">Ofis</th>
              <th scope="col">Yetkili</th>
              <th scope="col">Telefon</th>
              <th scope="col">Paket</th>
              <th scope="col">Durum</th>
              <th scope="col">Lisans bitişi</th>
            </tr>
          </thead>
          <tbody>
            {hepsi.length === 0 ? (
              <tr>
                <td colSpan={6}>{q || a.durum ? 'Aramaya uyan ofis yok.' : 'Henüz ofis yok. "Yeni ofis aç" ile ilk ofisi açın.'}</td>
              </tr>
            ) : (
              ofisler.map((o) => (
                <tr key={o.orgId}>
                  <td>{o.officeName}</td>
                  <td>
                    {o.contactName || '—'}
                    {o.contactEmail ? <div className="alt">{o.contactEmail}</div> : null}
                  </td>
                  <td>{o.contactPhone || '—'}</td>
                  <td>{o.planName || '—'}</td>
                  <td>
                    <span className={`durum ${o.status}`}>{DURUM_ADI[o.status]}</span>
                  </td>
                  <td>{tarih(o.expiresAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <nav className="sayfalama" aria-label="Sayfalar">
        <p className="alt">
          {hepsi.length} ofis{sayfaSayisi > 1 ? ` · sayfa ${sayfa}/${sayfaSayisi}` : ''}
        </p>
        {sayfa > 1 ? (
          <a className="dugme ikincil" href={sayfaAdresi(sayfa - 1)}>
            Önceki sayfa
          </a>
        ) : null}
        {sayfa < sayfaSayisi ? (
          <a className="dugme ikincil" href={sayfaAdresi(sayfa + 1)}>
            Sonraki sayfa
          </a>
        ) : null}
      </nav>
    </Kabuk>
  );
}
