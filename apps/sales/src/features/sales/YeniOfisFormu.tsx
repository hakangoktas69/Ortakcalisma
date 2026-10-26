'use client';

import { useState } from 'react';
import { aciklama, Alan } from '@/shared/ui/Alan.tsx';
import { istek } from '@/shared/ui/istek.ts';

// "Yeni ofis" formu. Alan hataları alanın altında (aria-describedby), genel hata üstte; işlem sürerken düğme kilitli
// (çift tıklama). Başarıda geçici parola YALNIZ bu ekranda bir kez görünür; sayfa yenilenince kaybolur.

type Paket = { key: string; ad: string };
type Sonuc = { ofisAdi: string; eposta: string; geciciParola: string };
const ALANLAR = ['officeName', 'contactName', 'email', 'phone', 'plan', 'trialDays'] as const;
type AlanAdi = (typeof ALANLAR)[number];

export function YeniOfisFormu({ csrf, paketler, varsayilanGun, enFazlaGun }: { csrf: string; paketler: Paket[]; varsayilanGun: number; enFazlaGun: number }) {
  const [hata, setHata] = useState<string | null>(null);
  const [alanHatasi, setAlanHatasi] = useState<Partial<Record<AlanAdi, string>>>({});
  const [bekliyor, setBekliyor] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  if (sonuc) {
    return (
      <section className="kart sonuc" aria-labelledby="sonuc-baslik">
        <p className="basari" role="status">
          Ofis açıldı.
        </p>
        <h2 id="sonuc-baslik">Müşavire iletilecek bilgiler</h2>
        <dl>
          <dt>Ofis</dt>
          <dd>{sonuc.ofisAdi}</dd>
          <dt>E-posta</dt>
          <dd>{sonuc.eposta}</dd>
          <dt>Geçici parola</dt>
          <dd className="anahtar" aria-label="Geçici parola">
            {sonuc.geciciParola}
          </dd>
        </dl>
        <p className="uyari">Geçici parola bir daha gösterilmez. Müşavire güvenli bir kanaldan iletin (e-postayla aynı mesajda göndermeyin).</p>
        <div className="eylemler">
          <a className="dugme birincil" href="/">
            Ofis listesine dön
          </a>
          <a className="dugme ikincil" href="/yeni">
            Başka ofis aç
          </a>
        </div>
      </section>
    );
  }

  const alan = (ad: AlanAdi, ipucu = false) => ({ name: ad, ...aciklama(`alan-${ad}`, ipucu, alanHatasi[ad]) });

  return (
    <form
      className="form kart"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget);
        setBekliyor(true);
        setHata(null);
        setAlanHatasi({});
        const govde = Object.fromEntries(ALANLAR.map((a) => [a, String(v.get(a) ?? '')]));
        const r = await istek<{ ofisAdi: string; eposta: string; geciciParola: string }>('/api/ofisler', 'POST', csrf, govde);
        setBekliyor(false);
        if (r.ok) setSonuc(r.veri);
        else {
          setHata(r.mesaj);
          setAlanHatasi(Object.fromEntries((r.alanlar ?? []).filter((a) => (ALANLAR as readonly string[]).includes(a.alan)).map((a) => [a.alan, a.mesaj])));
        }
      }}
    >
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
      <div className="form-satir">
        <Alan id="alan-officeName" etiket="Ofis adı" hata={alanHatasi.officeName}>
          <input {...alan('officeName')} required maxLength={200} autoComplete="organization" />
        </Alan>
        <Alan id="alan-contactName" etiket="Müşavirin adı soyadı" hata={alanHatasi.contactName}>
          <input {...alan('contactName')} required maxLength={200} autoComplete="name" />
        </Alan>
      </div>
      <div className="form-satir">
        <Alan id="alan-email" etiket="E-posta" ipucu="Müşavir portala bu adresle girer." hata={alanHatasi.email}>
          <input {...alan('email', true)} type="email" required maxLength={254} autoComplete="email" />
        </Alan>
        <Alan id="alan-phone" etiket="Telefon" ipucu="Örn. 0532 123 45 67" hata={alanHatasi.phone}>
          <input {...alan('phone', true)} type="tel" required maxLength={20} autoComplete="tel" />
        </Alan>
      </div>
      <div className="form-satir">
        <Alan id="alan-plan" etiket="Paket" hata={alanHatasi.plan}>
          <select {...alan('plan')} required defaultValue="">
            <option value="" disabled>
              Paket seçin
            </option>
            {paketler.map((p) => (
              <option key={p.key} value={p.key}>
                {p.ad}
              </option>
            ))}
          </select>
        </Alan>
        <Alan id="alan-trialDays" etiket="Deneme süresi (gün)" ipucu={`1–${enFazlaGun} gün; boş bırakılırsa ${varsayilanGun}.`} hata={alanHatasi.trialDays}>
          <input {...alan('trialDays', true)} type="number" min={1} max={enFazlaGun} step={1} defaultValue={varsayilanGun} inputMode="numeric" />
        </Alan>
      </div>
      <div className="eylemler">
        <button type="submit" className="dugme birincil" disabled={bekliyor}>
          {bekliyor ? 'Ofis açılıyor…' : 'Ofisi aç'}
        </button>
        <a href="/">Vazgeç</a>
      </div>
    </form>
  );
}
