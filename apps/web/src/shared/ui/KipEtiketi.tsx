// Yığın kipi logo yanında (D39): demo, geliştirme ve hata ayıklama ortamı canlıyla karıştırılmasın. Değer sunucuda,
// her istekte YIGIN_KIPI'den okunur (compose .env'den, Docker'sız web .env.local'den); üretimde ya da kip bilinmiyorsa
// hiçbir şey çizilmez (Helm/üretim varsayılanı).

const ETIKETLER: Record<string, string> = { demo: 'Demo', gelistirme: 'Geliştirme', debug: 'Debug' };

export const yiginKipiEtiketi = (env: Record<string, string | undefined> = process.env): string | null =>
  ETIKETLER[env['YIGIN_KIPI'] ?? ''] ?? null;

export function KipEtiketi() {
  const etiket = yiginKipiEtiketi();
  if (!etiket) return null;
  return (
    <span className="kip-etiketi">
      <span className="gorunmez">Yığın kipi: </span>
      {etiket}
    </span>
  );
}
