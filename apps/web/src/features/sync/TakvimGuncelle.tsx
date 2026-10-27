'use client';

import { IsDurumuSatiri, useKurumIsi, type IsDurumu } from './KurumIsi.tsx';

// Takvimi kaynaklardan güncelleme (genel_bakis.takvim.sync): seçili yılın GİB vergi takvimi ve resmî tatilleri arka planda
// çekilir; iş bitince takvim yenilenir. Kurum hesabı kullanılmaz (kamuya açık kaynak).
export function TakvimGuncelle({ csrf, yil, ilk }: { csrf: string; yil: number; ilk: IsDurumu | null }) {
  const k = useKurumIsi(ilk);
  return (
    <div className="kurum-isi">
      <button type="button" className="dugme ikincil" disabled={k.bekliyor || k.suruyor} onClick={() => k.baslat('/api/sync/takvim', csrf, { yil })}>
        {k.suruyor ? 'Güncelleniyor…' : `${yil} takvimini kaynaklardan güncelle`}
      </button>
      <IsDurumuSatiri is={k.is} hata={k.hata} />
    </div>
  );
}
