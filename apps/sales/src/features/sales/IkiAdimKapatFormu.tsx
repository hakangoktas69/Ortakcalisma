'use client';

import { useState } from 'react';
import { aciklama, Alan } from '@/shared/ui/Alan.tsx';
import { istek } from '@/shared/ui/istek.ts';

// 2FA kapatma formu: parola + güncel kod (ya da kurtarma kodu). Başarıda sayfa yenilenir (durum "kapalı" görünür).
export function IkiAdimKapatFormu({ csrf }: { csrf: string }) {
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget);
        setBekliyor(true);
        setHata(null);
        const r = await istek('/api/guvenlik/2fa/kapat', 'POST', csrf, { parola: v.get('parola'), kod: v.get('kod'), kurtarma: v.get('kurtarma') });
        setBekliyor(false);
        if (r.ok) window.location.assign('/sifre?2fa=kapatildi');
        else setHata(r.mesaj);
      }}
    >
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
      <div className="form-satir">
        <Alan id="kapat-parola" etiket="Parola">
          <input {...aciklama('kapat-parola', false)} name="parola" type="password" autoComplete="current-password" required maxLength={128} />
        </Alan>
        <Alan id="kapat-kod" etiket="Doğrulama kodu" ipucu="Telefonunuzdaki 6 haneli kod.">
          <input {...aciklama('kapat-kod', true)} name="kod" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
        </Alan>
      </div>
      <details>
        <summary>Telefonuma erişemiyorum</summary>
        <Alan id="kapat-kurtarma" etiket="Kurtarma kodu">
          <input {...aciklama('kapat-kurtarma', false)} name="kurtarma" autoComplete="off" maxLength={20} />
        </Alan>
      </details>
      <div className="eylemler">
        <button type="submit" className="dugme ikincil" disabled={bekliyor}>
          {bekliyor ? 'Kapatılıyor…' : 'İki adımlı doğrulamayı kapat'}
        </button>
      </div>
    </form>
  );
}
