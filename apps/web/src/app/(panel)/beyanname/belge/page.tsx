import { documentsFor, KIND_LABEL } from '@eworks/documents';
import { isAllowed } from '@eworks/identity-access';
import { listDeclarations, periodLabel } from '@eworks/tax-filing';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// Beyanname / tahakkuk PDF (beyanname.belge): alınan belgeler. Dosyalar saklama süresi (D15, vars. 7 gün) dolunca silinir;
// satır "silindi" olarak kalır, senkron belgeyi yeniden alır. Her indirme denetim kaydına yazılır.
export default async function Belgeler() {
  const { oturum, izinli } = await sayfaIzni('beyanname.belge.view');
  if (!izinli) return <Yasak />;
  const ctx = baglam(oturum);
  const k = konteyner();
  const beyannameler = await listDeclarations(ctx, { limit: 1000 }, k.beyannameler);
  const belgeler = await documentsFor(ctx, beyannameler.map((b) => b.id), k.belgeler);
  const konu = new Map(beyannameler.map((b) => [b.id, b]));
  const indirebilir = isAllowed(oturum.grants, 'beyanname.belge.download');
  return (
    <>
      <Baslik k="beyanname.belge" alt="GİB'den alınan beyanname ve tahakkuk PDF'leri. Dosyalar saklama süresi dolunca silinir, kayıt kalır." />
      <div className="tablo-kap">
        <table>
          <caption className="gorunmez">Belgeler</caption>
          <thead>
            <tr>
              <th>Mükellef</th>
              <th>Beyanname</th>
              <th>Dönem</th>
              <th>Belge</th>
              <th>Boyut</th>
              <th>Dosya</th>
            </tr>
          </thead>
          <tbody>
            {belgeler.length === 0 ? (
              <tr>
                <td colSpan={6}>Belge yok.</td>
              </tr>
            ) : (
              belgeler.map((b) => {
                const s = konu.get(b.subjectId);
                return (
                  <tr key={b.id}>
                    <td>{s?.firmTitle ?? '—'}</td>
                    <td>{s?.type ?? '—'}</td>
                    <td>{s ? periodLabel(s.periodStart, s.periodEnd) : '—'}</td>
                    <td>{KIND_LABEL[b.kind]}</td>
                    <td>{(b.size / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB</td>
                    <td>
                      {b.fileDeletedAt ? (
                        <span className="etiket">Saklama süresi doldu</span>
                      ) : indirebilir ? (
                        <FeatureGate k="beyanname.belge.download">
                          <a href={`/api/belgeler/${b.id}`} download>
                            PDF indir
                          </a>
                        </FeatureGate>
                      ) : (
                        <span className="etiket iyi">Saklanıyor</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
