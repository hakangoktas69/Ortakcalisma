'use client';

import { useState } from 'react';
import { aciklama, Alan } from '@/shared/ui/Alan.tsx';
import { istek } from '@/shared/ui/istek.ts';

// 2FA açma onayı (oturumdan): parola + kod doğruysa açılır ve kurtarma kodları YALNIZ bu ekranda bir kez gösterilir.
export function KurulumFormu({ csrf }: { csrf: string }) {
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [kodlar, setKodlar] = useState<string[] | null>(null);
  if (kodlar) {
    return (
      <section className="sonuc" aria-labelledby="kodlar-baslik">
        <p className="basari" role="status">
          İki adımlı doğrulama açıldı.
        </p>
        <h2 id="kodlar-baslik">Kurtarma kodlarınız</h2>
        <p className="uyari">Bu kodlar bir daha gösterilmez. Telefonunuza erişemezseniz giriş için kullanılır; her kod bir kez geçer. Güvenli bir yere kaydedin.</p>
        <ul className="kodlar" aria-label="Kurtarma kodları">
          {kodlar.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <a className="dugme birincil" href="/sifre">
          Kodları kaydettim, devam et
        </a>
      </section>
    );
  }
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBekliyor(true);
        setHata(null);
        const v = new FormData(e.currentTarget);
        const r = await istek<{ kurtarmaKodlari?: unknown }>('/api/guvenlik/2fa', 'POST', csrf, { parola: v.get('parola'), kod: v.get('kod') });
        setBekliyor(false);
        const gelen = r.ok ? r.veri.kurtarmaKodlari : null;
        if (Array.isArray(gelen) && gelen.every((k) => typeof k === 'string')) setKodlar(gelen);
        else setHata(r.ok ? 'Kod doğrulanamadı.' : r.mesaj);
      }}
    >
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
      <div className="form-satir">
        <Alan id="ac-parola" etiket="Parola" ipucu="Hesabın sizin olduğunu doğrulamak için.">
          <input {...aciklama('ac-parola', true)} name="parola" type="password" autoComplete="current-password" required maxLength={128} />
        </Alan>
        <Alan id="ac-kod" etiket="Doğrulama kodu" ipucu="Uygulamanın gösterdiği 6 haneli kod.">
          <input {...aciklama('ac-kod', true)} name="kod" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
        </Alan>
      </div>
      <button type="submit" className="dugme birincil" disabled={bekliyor}>
        {bekliyor ? 'Doğrulanıyor…' : 'İki adımlı doğrulamayı aç'}
      </button>
    </form>
  );
}
