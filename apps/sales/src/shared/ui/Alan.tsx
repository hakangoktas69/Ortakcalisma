// Form alanı: etiket, denetim, ipucu ve hata. İpucu ve hata etikete değil `aria-describedby` ile denetime bağlanır
// (erişilebilir ad yalnız etiket olur; ekran okuyucu ipucunu ve hatayı ayrıca okur).

export function Alan({ id, etiket, ipucu, hata, children }: { id: string; etiket: string; ipucu?: string; hata?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="alan">
      <label htmlFor={id}>{etiket}</label>
      {children}
      {ipucu ? (
        <span className="ipucu" id={`${id}-ipucu`}>
          {ipucu}
        </span>
      ) : null}
      {hata ? (
        <span className="alan-hatasi" id={`${id}-hata`}>
          {hata}
        </span>
      ) : null}
    </div>
  );
}

/** Denetime verilecek açıklama bağları: ipucu ve (varsa) hata. */
export const aciklama = (id: string, ipucu: boolean, hata?: string) => {
  const ids = [ipucu ? `${id}-ipucu` : '', hata ? `${id}-hata` : ''].filter(Boolean).join(' ');
  return { id, ...(ids ? { 'aria-describedby': ids } : {}), ...(hata ? { 'aria-invalid': true as const } : {}) };
};
