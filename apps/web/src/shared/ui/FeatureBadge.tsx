import { durum, durumGosterilir, ozellik } from './ozellik.ts';

// Kırmızı/yeşil işaret (06 §8.3, D30 → D39): geliştirme ve hata ayıklama kipinde tamamlanmamış düğüm herkese kırmızı görünür;
// demo ve üretimde hiçbir işaret çizilmez, portal normal görünümündedir (`durumGosterilir`). Renk tek başına anlam taşımaz:
// kırmızıda "Geliştiriliyor" metni ve simgesi de vardır. Kurumla konuşan işlemde canlı doğrulama beklendiği yazılır.
export function FeatureBadge({ k, kucuk = false }: { k: string; kucuk?: boolean }) {
  if (!durumGosterilir()) return null;
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

/** İşlem düğmesini sarar: kırmızıysa kırmızı çerçeve ve rozet; düğme devre dışı değildir (geliştirici ve test denesin).
 * Normal görünümde (demo/üretim) yalnız sarmalayıcı kalır, iç özellik anahtarı da yazılmaz; uygulanmamış işlemi sunucu yine 501 ile reddeder. */
export function FeatureGate({ k, children }: { k: string; children: React.ReactNode }) {
  if (!durumGosterilir()) return <span className="kapi">{children}</span>;
  const kirmizi = durum(k).status === 'red';
  return (
    <span className={kirmizi ? 'kapi kirmizi' : 'kapi'} data-ozellik={k}>
      {children}
      {kirmizi ? <FeatureBadge k={k} kucuk /> : null}
    </span>
  );
}
