import { durum, ozellik } from './ozellik.ts';

// Kırmızı/yeşil işaret (06 §8.3, D30): tamamlanmamış düğüm herkese, her ortamda kırmızı görünür. Renk tek başına anlam
// taşımaz: kırmızıda "Geliştiriliyor" metni ve simgesi de vardır. Kurumla konuşan işlemde canlı doğrulama beklendiği yazılır.
export function FeatureBadge({ k, kucuk = false }: { k: string; kucuk?: boolean }) {
  const d = durum(k);
  if (d.status === 'green') return kucuk ? null : <span className="rozet yesil" title="Tamamlandı">✓ Tamamlandı</span>;
  const f = ozellik(k);
  const ilerleme = f?.kind === 'action' ? '' : ` ${d.green}/${d.total}`;
  const neden = f?.live && d.tests > 0 ? 'Canlı doğrulama bekliyor' : 'Geliştiriliyor';
  return (
    <span className="rozet kirmizi" title={`${neden} — ${d.green}/${d.total} işlem tamamlandı`} data-ozellik={k} data-durum="red">
      <span aria-hidden="true">●</span>
      {kucuk ? <span className="gorunmez">{neden}</span> : `${neden}${ilerleme}`}
    </span>
  );
}

/** İşlem düğmesini sarar: kırmızıysa kırmızı çerçeve ve rozet; düğme devre dışı değildir (geliştirici ve test denesin). */
export function FeatureGate({ k, children }: { k: string; children: React.ReactNode }) {
  const kirmizi = durum(k).status === 'red';
  return (
    <span className={kirmizi ? 'kapi kirmizi' : 'kapi'} data-ozellik={k}>
      {children}
      {kirmizi ? <FeatureBadge k={k} kucuk /> : null}
    </span>
  );
}
