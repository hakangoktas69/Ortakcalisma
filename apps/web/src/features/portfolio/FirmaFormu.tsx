'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// Firma kartı formu (yeni / düzenle). Alanlar eski portalın firma formundan; doğrulama sunucudadır, hatalar alan yanında.

export type FirmaDegerleri = {
  title: string;
  kind: string;
  taxId: string;
  taxOffice: string;
  city: string;
  representative: string;
  phone: string;
  email: string;
  activityCode: string;
  activityName: string;
  taxRegime: string;
  status: string;
  groupName: string;
};

const TURLER = ['Limited', 'Anonim', 'Şahıs', 'Esnaf', 'Serbest Meslek', 'Belirtilmedi'];
const USULLER = ['Belirtilmedi', 'Gerçek Usul', 'Basit Usul'];
const DURUMLAR = ['Onay Bekliyor', 'Aktif', 'Pasif'];

export function FirmaFormu({ csrf, id, version, ilk }: { csrf: string; id?: string; version?: number; ilk?: Partial<FirmaDegerleri> }) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [alanHatalari, setAlanHatalari] = useState<Record<string, string>>({});
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const r = id
      ? await istek<{ id: string }>(`/api/firmalar/${id}`, 'PUT', csrf, { ...v, version })
      : await istek<{ id: string }>('/api/firmalar', 'POST', csrf, v);
    setBekliyor(false);
    if (r.ok) {
      router.push(`/firmalar/kart/${r.veri.id}?ok=${id ? 'guncellendi' : 'eklendi'}`);
      router.refresh();
      return;
    }
    setHata(r.mesaj);
    setAlanHatalari(Object.fromEntries((r.alanlar ?? []).map((a) => [a.alan, a.mesaj])));
  }

  const alan = (ad: keyof FirmaDegerleri, etiket: string, ozellik: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>
      {etiket}
      <input name={ad} defaultValue={ilk?.[ad] ?? ''} aria-invalid={alanHatalari[ad] ? true : undefined} {...ozellik} />
      {alanHatalari[ad] ? <span className="hata">{alanHatalari[ad]}</span> : null}
    </label>
  );
  const secim = (ad: keyof FirmaDegerleri, etiket: string, secenekler: string[]) => (
    <label>
      {etiket}
      <select name={ad} defaultValue={ilk?.[ad] ?? secenekler[0]}>
        {secenekler.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {alanHatalari[ad] ? <span className="hata">{alanHatalari[ad]}</span> : null}
    </label>
  );

  return (
    <form className="form kart" onSubmit={gonder} noValidate>
      {hata ? (
        <p className="hata" role="alert">
          {hata}
        </p>
      ) : null}
      <fieldset className="form-bolumu">
        <legend>Temel bilgiler</legend>
        <div className="form-satir">
          {alan('title', 'Firma / mükellef unvanı', { required: true, maxLength: 300 })}
          {alan('taxId', 'VKN / TCKN', { required: true, inputMode: 'numeric', maxLength: 11 })}
          {alan('taxOffice', 'Vergi dairesi', { maxLength: 120 })}
          {alan('email', 'E-posta', { type: 'email', maxLength: 160 })}
          {alan('phone', 'Telefon', { type: 'tel', maxLength: 40 })}
        </div>
      </fieldset>
      <fieldset className="form-bolumu">
        <legend>Firma ve sorumlu bilgileri</legend>
        <div className="form-satir">
          {secim('kind', 'Firma türü', TURLER)}
          {secim('taxRegime', 'Vergilendirme usulü', USULLER)}
          {alan('city', 'İl', { maxLength: 80 })}
          {alan('representative', 'Yetkili', { maxLength: 160 })}
          {alan('activityCode', 'Faaliyet / NACE kodu', { maxLength: 20 })}
          {alan('activityName', 'Faaliyet adı', { maxLength: 300 })}
          {alan('groupName', 'Mükellef grubu', { maxLength: 120 })}
          {secim('status', 'Firma onay durumu', DURUMLAR)}
        </div>
      </fieldset>
      <div className="eylemler">
        <button type="submit" className="dugme birincil" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  );
}
