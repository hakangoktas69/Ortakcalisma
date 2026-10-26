'use client';

import { useState } from 'react';
import { aciklama, Alan } from '@/shared/ui/Alan.tsx';
import { istek } from '@/shared/ui/istek.ts';

// Parola değiştirme formu: mevcut parola + yeni parola (iki kez). Başarıda ofis listesine geçiş bağlantısı.
export function SifreFormu({ csrf }: { csrf: string }) {
  const [durum, setDurum] = useState<{ tur: 'basari' | 'hata'; mesaj: string } | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  return (
    <form
      className="form kart"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = new FormData(form);
        if (v.get('yeni') !== v.get('tekrar')) {
          setDurum({ tur: 'hata', mesaj: 'Yeni parola ile tekrarı aynı değil.' });
          return;
        }
        setBekliyor(true);
        const r = await istek('/api/oturum/sifre', 'POST', csrf, { mevcut: v.get('mevcut'), yeni: v.get('yeni') });
        setBekliyor(false);
        if (r.ok) {
          form.reset();
          setDurum({ tur: 'basari', mesaj: 'Parolanız değişti.' });
        } else setDurum({ tur: 'hata', mesaj: r.mesaj });
      }}
    >
      {durum ? (
        <p className={durum.tur} role={durum.tur === 'hata' ? 'alert' : 'status'}>
          {durum.mesaj} {durum.tur === 'basari' ? <a href="/">Ofis listesine git</a> : null}
        </p>
      ) : null}
      <Alan id="mevcut" etiket="Mevcut parola">
        <input {...aciklama('mevcut', false)} name="mevcut" type="password" autoComplete="current-password" required maxLength={128} />
      </Alan>
      <div className="form-satir">
        <Alan id="yeni" etiket="Yeni parola" ipucu="En az 12 karakter; harf ve rakam içermeli.">
          <input {...aciklama('yeni', true)} name="yeni" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
        </Alan>
        <Alan id="tekrar" etiket="Yeni parola (tekrar)">
          <input {...aciklama('tekrar', false)} name="tekrar" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
        </Alan>
      </div>
      <div className="eylemler">
        <button type="submit" className="dugme birincil" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Parolayı değiştir'}
        </button>
      </div>
    </form>
  );
}
