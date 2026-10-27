'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// Kişisel hatırlatma formu ve işlemleri (Mert'in takvimindeki "Yeni Hatırlatma"). Hatırlatma yalnız kullanıcıya görünür;
// uyarı uygulama içidir (takvim ve ana sayfada "yaklaşan hatırlatmalar").

type Secenek = { id: string; ad: string };
export type HatirlatmaOnDegeri = { title?: string; remindOn?: string; category?: string; sourceEntry?: string };

export function HatirlatmaFormu({
  csrf,
  kategoriler,
  firmalar,
  ilk,
  acik: ilkAcik = false,
}: {
  csrf: string;
  kategoriler: readonly Secenek[];
  firmalar: readonly Secenek[];
  ilk?: HatirlatmaOnDegeri;
  acik?: boolean;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(ilkAcik);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [alanlar, setAlanlar] = useState<Record<string, string>>({});
  const [bekliyor, setBekliyor] = useState(false);
  const alanHatasi = (ad: string) => (alanlar[ad] ? <span className="hata">{alanlar[ad]}</span> : null);
  if (!acik) {
    return (
      <div className="eylemler">
        {basari ? (
          <p className="basari" role="status">
            {basari}
          </p>
        ) : null}
        <button type="button" className="dugme birincil" onClick={() => setAcik(true)}>
          Hatırlatma ekle
        </button>
      </div>
    );
  }
  return (
    <form
      className="form kart"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBekliyor(true);
        setHata(null);
        const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        const r = await istek('/api/hatirlatmalar', 'POST', csrf, { ...v, remindDays: Number(v['remindDays']), sourceEntry: ilk?.sourceEntry ?? '' });
        setBekliyor(false);
        if (r.ok) {
          setAlanlar({});
          setAcik(false);
          setBasari('Hatırlatma eklendi.');
          router.refresh();
          return;
        }
        setHata(r.mesaj);
        setAlanlar(Object.fromEntries((r.alanlar ?? []).map((a) => [a.alan, a.mesaj])));
      }}
    >
      <h2>Yeni hatırlatma</h2>
      <p className="alt">Hatırlatma yalnız size görünür. Uyarı Eworks açıkken takvimde ve ana sayfada gösterilir; e-posta ya da SMS gönderilmez.</p>
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
      <div className="form-satir">
        <label>
          Başlık
          <input name="title" required maxLength={250} defaultValue={ilk?.title ?? ''} aria-invalid={alanlar['title'] ? true : undefined} />
          {alanHatasi('title')}
        </label>
        <label>
          Tarih
          <input name="remindOn" type="date" required defaultValue={ilk?.remindOn ?? ''} aria-invalid={alanlar['remindOn'] ? true : undefined} />
          {alanHatasi('remindOn')}
        </label>
        <label>
          Saat (isteğe bağlı)
          <input name="remindTime" type="time" aria-invalid={alanlar['remindTime'] ? true : undefined} />
          {alanHatasi('remindTime')}
        </label>
        <label>
          Kategori
          <select name="category" defaultValue={ilk?.category ?? 'not'}>
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hatırlatma
          <select name="remindDays" defaultValue="3">
            <option value="0">Aynı gün</option>
            <option value="1">1 gün önce</option>
            <option value="3">3 gün önce</option>
            <option value="7">7 gün önce</option>
          </select>
        </label>
        <label>
          Mükellef
          <select name="firmId" defaultValue="" aria-invalid={alanlar['firmId'] ? true : undefined}>
            <option value="">Ofis / genel</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
          </select>
          {alanHatasi('firmId')}
        </label>
      </div>
      <label>
        Not
        <textarea name="note" rows={3} maxLength={3000} aria-invalid={alanlar['note'] ? true : undefined} />
        {alanHatasi('note')}
      </label>
      <div className="eylemler">
        <button type="submit" className="dugme birincil" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Hatırlatmayı kaydet'}
        </button>
        <button type="button" className="dugme ikincil" disabled={bekliyor} onClick={() => setAcik(false)}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}

export function HatirlatmaIslemleri({ csrf, id, done, baslik }: { csrf: string; id: string; done: boolean; baslik: string }) {
  const router = useRouter();
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  async function yap(fn: () => ReturnType<typeof istek>) {
    setBekliyor(true);
    const r = await fn();
    setBekliyor(false);
    if (r.ok) router.refresh();
    else setHata(r.mesaj);
  }
  return (
    <span className="hatirlatma-islem">
      <button
        type="button"
        className="dugme ikincil kucuk"
        disabled={bekliyor}
        aria-label={`${baslik}: ${done ? 'yeniden aç' : 'tamamlandı'}`}
        onClick={() => void yap(() => istek(`/api/hatirlatmalar/${id}`, 'POST', csrf, { done: !done }))}
      >
        {done ? 'Yeniden aç' : 'Tamamlandı'}
      </button>
      <button type="button" className="dugme ikincil kucuk" disabled={bekliyor} aria-label={`${baslik}: sil`} onClick={() => void yap(() => istek(`/api/hatirlatmalar/${id}`, 'DELETE', csrf))}>
        Sil
      </button>
      {hata ? (
        <span className="hata" role="alert">
          {hata}
        </span>
      ) : null}
    </span>
  );
}
