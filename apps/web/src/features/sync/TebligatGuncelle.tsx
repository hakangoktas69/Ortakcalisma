'use client';

import { IsDurumuSatiri, useKurumIsi, type IsDurumu } from './KurumIsi.tsx';

// e-Tebligat'ı GİB'den güncelleme (tebligat.liste.sync): firmanın kendi hesabıyla, mükellef onayı varken. Liste okunur, belge açılmaz.
export function TebligatGuncelle({ csrf, firmaId, ilk }: { csrf: string; firmaId: string; ilk: IsDurumu | null }) {
  const k = useKurumIsi(ilk);
  return (
    <div className="kurum-isi">
      <button type="button" className="dugme birincil" disabled={k.bekliyor || k.suruyor} onClick={() => k.baslat('/api/sync/etebligat', csrf, { firmaId })}>
        {k.suruyor ? 'Güncelleniyor…' : "e-Tebligat'ı GİB'den güncelle"}
      </button>
      <IsDurumuSatiri is={k.is} hata={k.hata} />
    </div>
  );
}
