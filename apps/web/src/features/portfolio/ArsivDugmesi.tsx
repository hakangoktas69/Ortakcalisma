'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

/** Arşivle: veri silinmez (10 yıl), firma listeden kalkar. Yanlış tıklamaya karşı ikinci onay istenir. */
export function ArsivDugmesi({ csrf, id }: { csrf: string; id: string }) {
  const router = useRouter();
  const [onay, setOnay] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  if (!onay) {
    return (
      <button type="button" className="dugme ikincil" onClick={() => setOnay(true)}>
        Arşivle
      </button>
    );
  }
  return (
    <span className="eylemler">
      <button
        type="button"
        className="dugme tehlike"
        onClick={async () => {
          const r = await istek(`/api/firmalar/${id}/arsiv`, 'POST', csrf);
          if (r.ok) {
            router.push('/firmalar/liste?ok=arsivlendi');
            router.refresh();
          } else setHata(r.mesaj);
        }}
      >
        Evet, arşivle
      </button>
      <button type="button" className="dugme ikincil" onClick={() => setOnay(false)}>
        Vazgeç
      </button>
      {hata ? <span className="hata">{hata}</span> : null}
    </span>
  );
}
