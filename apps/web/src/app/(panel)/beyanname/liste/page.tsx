import Link from 'next/link';
import { documentsFor, KIND_LABEL } from '@eworks/documents';
import { isAllowed } from '@eworks/identity-access';
import { declarationTypes, listDeclarations, periodLabel } from '@eworks/tax-filing';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// e-Beyanname görüntüleme (beyanname.liste): mükellef, tür, yıl süzgeci; belgeler (PDF) satırda; CSV dışa aktarma.
type Ara = { q?: string; tur?: string; yil?: string };

export default async function BeyannameListesi({ searchParams }: { searchParams: Promise<Ara> }) {
  const { oturum, izinli } = await sayfaIzni('beyanname.liste.view');
  if (!izinli) return <Yasak />;
  const a = await searchParams;
  const ctx = baglam(oturum);
  const k = konteyner();
  const yil = /^\d{4}$/.test(a.yil ?? '') ? Number(a.yil) : undefined;
  const [satirlar, turler] = await Promise.all([listDeclarations(ctx, { q: a.q ?? '', type: a.tur ?? '', year: yil }, k.beyannameler), declarationTypes(ctx, k.beyannameler)]);
  const pdfIzni = isAllowed(oturum.grants, 'beyanname.belge.download');
  const belgeler = pdfIzni ? await documentsFor(ctx, satirlar.map((s) => s.id), k.belgeler) : [];
  const sorgu = new URLSearchParams(Object.entries({ q: a.q ?? '', tur: a.tur ?? '', yil: a.yil ?? '' }).filter(([, v]) => v));
  return (
    <>
      <Baslik k="beyanname.liste" alt="GİB'den alınan e-Beyannameler; belgeler satırda.">
        {isAllowed(oturum.grants, 'beyanname.liste.export') ? (
          <FeatureGate k="beyanname.liste.export">
            <a className="dugme ikincil" href={`/api/beyanname/csv?${sorgu}`} download>
              CSV indir
            </a>
          </FeatureGate>
        ) : null}
        {isAllowed(oturum.grants, 'beyanname.senkron.start') ? (
          <Link className="dugme birincil" href="/beyanname/senkron">
            Senkron
          </Link>
        ) : null}
      </Baslik>
      <form className="filtre" method="get">
        <label>
          Ara
          <input name="q" type="search" defaultValue={a.q ?? ''} placeholder="Unvan, VKN/TCKN" />
        </label>
        <label>
          Beyanname türü
          <select name="tur" defaultValue={a.tur ?? ''}>
            <option value="">Tümü</option>
            {turler.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Dönem yılı
          <input name="yil" inputMode="numeric" pattern="\d{4}" defaultValue={a.yil ?? ''} placeholder="2026" />
        </label>
        <button type="submit" className="dugme ikincil">
          Süz
        </button>
      </form>
      <div className="tablo-kap">
        <table>
          <caption className="gorunmez">e-Beyannameler</caption>
          <thead>
            <tr>
              <th>Mükellef</th>
              <th>VKN / TCKN</th>
              <th>Tür</th>
              <th>Dönem</th>
              <th>Yükleme</th>
              <th>Tahakkuk</th>
              <th>SGK</th>
              {pdfIzni ? <th>Belgeler</th> : null}
            </tr>
          </thead>
          <tbody>
            {satirlar.length === 0 ? (
              <tr>
                <td colSpan={pdfIzni ? 8 : 7}>Kayıt bulunamadı.</td>
              </tr>
            ) : (
              satirlar.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/firmalar/kart/${s.firmId}`}>{s.firmTitle}</Link>
                  </td>
                  <td>{s.taxId}</td>
                  <td>{s.type}</td>
                  <td>{periodLabel(s.periodStart, s.periodEnd)}</td>
                  <td>{new Date(s.uploadedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</td>
                  <td>
                    <span className={`etiket ${s.taxStatus === 'Onaylandı' ? 'iyi' : 'bekliyor'}`}>{s.taxStatus}</span>
                  </td>
                  <td>{s.sgkStatus || '—'}</td>
                  {pdfIzni ? (
                    <td className="belgeler">
                      {belgeler
                        .filter((b) => b.subjectId === s.id)
                        .map((b) =>
                          b.fileDeletedAt ? (
                            <span key={b.id} className="etiket" title="Saklama süresi doldu; senkron yeniden alır">
                              {KIND_LABEL[b.kind]} (silindi)
                            </span>
                          ) : (
                            <a key={b.id} href={`/api/belgeler/${b.id}`} download>
                              {KIND_LABEL[b.kind]}
                            </a>
                          ),
                        )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="alt">
        {satirlar.length} kayıt listeleniyor.{satirlar.some((s) => s.source === 'sahte_gib') ? ' Bu ortamdaki kayıtlar sahte GİB sunucusundan (demo).' : ''}
      </p>
    </>
  );
}
