'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// Kurum işi başlatma + canlı durum. İş arka planda sürer (robot, işçi); sayfa kapanırsa iş durmaz, döndüğünde son durum
// görünür. Bitince sunucu bileşeni yenilenir (yeni liste). Yoklama iki saniyede bir, yalnız iş sürerken.

export type IsDurumu = { id: string; durum: string; etiket: string; mesaj: string | null; bitti: boolean };

const SINIF: Record<string, string> = { succeeded: 'iyi', failed: 'kotu', wrong_password: 'kotu', cancelled: '', queued: 'bekliyor', running: 'bekliyor' };

export function KurumIsi({ csrf, uc, dugme, ilk, baslatabilir }: { csrf: string; uc: string; dugme: string; ilk: IsDurumu | null; baslatabilir: boolean }) {
  const router = useRouter();
  const [is, setIs] = useState<IsDurumu | null>(ilk);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  useEffect(() => {
    if (!is || is.bitti) return;
    let iptal = false;
    const t = setInterval(async () => {
      const r = await fetch(`/api/sync/isler/${is.id}`, { credentials: 'same-origin' }).catch(() => null);
      if (iptal || !r?.ok) return;
      const yeni = (await r.json()) as IsDurumu;
      setIs(yeni);
      if (yeni.bitti) router.refresh();
    }, 2000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, [is?.id, is?.bitti, router]);

  const suruyor = is !== null && !is.bitti;
  return (
    <div className="kurum-isi">
      {baslatabilir ? (
        <button
          type="button"
          className="dugme birincil"
          disabled={bekliyor || suruyor}
          onClick={async () => {
            setBekliyor(true);
            setHata(null);
            const r = await istek<{ isId: string }>(uc, 'POST', csrf);
            setBekliyor(false);
            if (r.ok) setIs({ id: r.veri.isId, durum: 'queued', etiket: 'Sırada', mesaj: null, bitti: false });
            else setHata(r.mesaj);
          }}
        >
          {suruyor ? 'Çalışıyor…' : dugme}
        </button>
      ) : null}
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
      {is ? (
        <p className="is-durumu" role="status" aria-live="polite">
          Son iş: <span className={`etiket ${SINIF[is.durum] ?? ''}`}>{is.etiket}</span> {is.mesaj ? <span>{is.mesaj}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
