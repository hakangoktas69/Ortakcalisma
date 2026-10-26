// Satış portalı markası + yığın kipi (D39: demo/geliştirme/debug canlıyla karışmasın; üretimde etiket yok).

const ETIKETLER: Record<string, string> = { demo: 'Demo', gelistirme: 'Geliştirme', debug: 'Debug' };

export function Marka() {
  const kip = ETIKETLER[process.env['YIGIN_KIPI'] ?? ''];
  return (
    <span className="marka">
      <span className="marka-isaret" aria-hidden="true">
        S
      </span>
      EWORKS SATIŞ
      {kip ? (
        <span className="kip-etiketi">
          <span className="gorunmez">Yığın kipi: </span>
          {kip}
        </span>
      ) : null}
    </span>
  );
}
