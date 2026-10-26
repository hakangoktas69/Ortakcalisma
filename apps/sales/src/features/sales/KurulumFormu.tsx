'use client';

import { useState } from 'react';

// 2FA kurulum onayı: kod doğruysa oturum açılır ve kurtarma kodları YALNIZ bu ekranda bir kez gösterilir.
// Ara adım çerezi HttpOnly'dir; istek aynı kökenden JSON ile gider (CSRF: aynı köken + SameSite=Strict, oturum henüz yok).

type Sonuc = { kurtarmaKodlari: string[]; sonraki: string };

export function KurulumFormu() {
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  if (sonuc) {
    return (
      <section className="sonuc" aria-labelledby="kodlar-baslik">
        <p className="basari" role="status">
          İki adımlı doğrulama açıldı.
        </p>
        <h2 id="kodlar-baslik">Kurtarma kodlarınız</h2>
        <p className="uyari">Bu kodlar bir daha gösterilmez. Telefonunuza erişemezseniz giriş için kullanılır; her kod bir kez geçer. Güvenli bir yere kaydedin.</p>
        <ul className="kodlar" aria-label="Kurtarma kodları">
          {sonuc.kurtarmaKodlari.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
        <a className="dugme birincil" href={sonuc.sonraki}>
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
        try {
          const r = await fetch('/api/oturum/kurulum', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kod: new FormData(e.currentTarget).get('kod') }),
            credentials: 'same-origin',
          });
          const veri = (await r.json().catch(() => ({}))) as Partial<Sonuc> & { mesaj?: string };
          if (r.ok && Array.isArray(veri.kurtarmaKodlari) && typeof veri.sonraki === 'string') setSonuc({ kurtarmaKodlari: veri.kurtarmaKodlari, sonraki: veri.sonraki });
          else if (r.status === 401) window.location.assign('/giris?hata=sure');
          else setHata(veri.mesaj ?? 'Kod doğrulanamadı.');
        } catch {
          setHata('Sunucuya ulaşılamadı.');
        } finally {
          setBekliyor(false);
        }
      }}
    >
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
      <label>
        Doğrulama kodu
        <input name="kod" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
      </label>
      <button type="submit" className="dugme birincil" disabled={bekliyor}>
        {bekliyor ? 'Doğrulanıyor…' : 'Kurulumu tamamla'}
      </button>
    </form>
  );
}
