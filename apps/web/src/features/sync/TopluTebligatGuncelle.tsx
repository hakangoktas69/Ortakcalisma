'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// "Tüm mükelleflerin e-Tebligatını çek" (tebligat.liste.sync; D45, D46). Her firma kendi GİB hesabıyla okunur,
// bu yüzden firma başına ayrı iş açılır; burada tek tek izlenmez, özet gösterilir. Onayı, hesabı olmayan ya da
// şifresi hatalı firma atlanır ve özet içinde sayılır — bunlar hata değil, eksik kurulumdur.
export function TopluTebligatGuncelle({ csrf }: { csrf: string }) {
  const router = useRouter();
  const [bekliyor, setBekliyor] = useState(false);
  const [ozet, setOzet] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const baslat = async () => {
    setBekliyor(true);
    setHata(null);
    setOzet(null);
    const r = await istek<{ mesaj: string; acilan: number }>('/api/sync/etebligat/toplu', 'POST', csrf);
    setBekliyor(false);
    if (!r.ok) {
      setHata(r.mesaj);
      return;
    }
    setOzet(r.veri.mesaj);
    // İşler arka planda sürer; liste bitince kendiliğinden tazelenmez, kullanıcı yenileyince dolu görür
    if (r.veri.acilan > 0) router.refresh();
  };

  return (
    <div className="kurum-isi">
      <button type="button" className="dugme birincil" disabled={bekliyor} onClick={baslat}>
        {bekliyor ? 'Başlatılıyor…' : "Tüm mükelleflerin e-Tebligatını çek"}
      </button>
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
      {ozet ? (
        <p className="is-durumu" role="status" aria-live="polite">
          {ozet}
        </p>
      ) : null}
    </div>
  );
}
