'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// Kurum hesabı girişi (GİB, SGK işyeri, UETS). Bilgiler yalnız Vault'a gider; form gönderildikten sonra temizlenir, hiçbir
// alan geri okunamaz. Alanlar kapalı başlar ve yalnız "bilgileri gir/değiştir" ile boş açılır (Mert 26.10, 69ececc): tarayıcı
// Eworks giriş parolasını bu alanlara kendiliğinden doldurmasın, kayıtlı hesap yanlışlıkla değişmesin. Alan adları giriş formuna
// benzemez. Alan tanımları sunucudan gelir (credentials INSTITUTION_FORMS); istemci paketine bağlam kodu girmez.

export type KurumFormu = {
  institution: string;
  title: string;
  labelRequired: boolean;
  labelTitle?: string;
  fields: readonly { name: string; title: string; secret: boolean; max: number }[];
};

const YOKSAY = { 'data-lpignore': 'true', 'data-1p-ignore': '', 'data-bwignore': '' };

export function KurumHesabiFormu({
  csrf,
  sahip,
  sahipId,
  baslik,
  aciklama,
  kayitli,
  form,
  etiket,
  acmaMetni,
}: {
  csrf: string;
  sahip: 'advisor' | 'firm';
  sahipId: string;
  baslik: string;
  aciklama: string;
  kayitli: boolean;
  form: KurumFormu;
  /** Kayıtlı bir SGK işyerinin adı: güncellemede ad sabit kalır. Yoksa ve kurum ad istiyorsa ad alanı gösterilir. */
  etiket?: string;
  acmaMetni?: string;
}) {
  const router = useRouter();
  const [durum, setDurum] = useState<{ tur: 'basari' | 'hata'; mesaj: string } | null>(null);
  const [alanHatalari, setAlanHatalari] = useState<Record<string, string>>({});
  const [bekliyor, setBekliyor] = useState(false);
  const [acik, setAcik] = useState(false);
  const ilkAlan = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (acik) ilkAlan.current?.focus();
  }, [acik]);
  const adSorulur = form.labelRequired && etiket === undefined;
  const hata = (ad: string) => (alanHatalari[ad] ? <span className="hata">{alanHatalari[ad]}</span> : null);
  return (
    <form
      className="form"
      autoComplete="off"
      onSubmit={async (e) => {
        e.preventDefault();
        const el = e.currentTarget;
        const v = new FormData(el);
        setBekliyor(true);
        const r = await istek('/api/kurum-hesaplari', 'PUT', csrf, {
          ownerKind: sahip,
          ownerId: sahipId,
          institution: form.institution,
          label: adSorulur ? String(v.get('kurum_etiket') ?? '') : (etiket ?? ''),
          fields: Object.fromEntries(form.fields.map((f) => [f.name, String(v.get(`kurum_${f.name}`) ?? '')])),
        });
        el.reset();
        setBekliyor(false);
        setDurum(r.ok ? { tur: 'basari', mesaj: `${form.title} hesabı Vault’a kaydedildi.` } : { tur: 'hata', mesaj: r.mesaj });
        setAlanHatalari(r.ok ? {} : Object.fromEntries((r.alanlar ?? []).map((a) => [a.alan === 'label' ? 'etiket' : a.alan, a.mesaj])));
        if (r.ok) {
          setAcik(false);
          router.refresh();
        }
      }}
    >
      <h3>{baslik}</h3>
      <p className="alt">{aciklama}</p>
      {kayitli ? <p className="alt">Kayıtlı bilgiler bu ekrana hiçbir zaman doldurulmaz; değiştirmek için yeni bilgileri girin.</p> : null}
      {durum ? (
        <p className={durum.tur} role="status">
          {durum.mesaj}
        </p>
      ) : null}
      {acik ? (
        <>
          <div className="form-satir">
            {adSorulur ? (
              <label>
                {form.labelTitle ?? 'Ad'}
                <input ref={ilkAlan} name="kurum_etiket" required maxLength={80} autoComplete="off" aria-invalid={alanHatalari['etiket'] ? true : undefined} />
                {hata('etiket')}
              </label>
            ) : null}
            {form.fields.map((f, i) => (
              <label key={f.name}>
                {f.title}
                <input
                  ref={!adSorulur && i === 0 ? ilkAlan : undefined}
                  name={`kurum_${f.name}`}
                  type={f.secret ? 'password' : 'text'}
                  required
                  maxLength={f.max}
                  autoComplete={f.secret ? 'new-password' : 'off'}
                  aria-invalid={alanHatalari[f.name] ? true : undefined}
                  {...YOKSAY}
                />
                {hata(f.name)}
              </label>
            ))}
          </div>
          <div className="eylemler">
            <button type="submit" className="dugme birincil" disabled={bekliyor}>
              {bekliyor ? 'Kaydediliyor…' : `${form.title} hesabını kaydet`}
            </button>
            <button type="button" className="dugme ikincil" disabled={bekliyor} onClick={() => setAcik(false)}>
              Vazgeç
            </button>
          </div>
        </>
      ) : (
        <div className="eylemler">
          <button
            type="button"
            className="dugme ikincil"
            onClick={() => {
              setDurum(null);
              setAlanHatalari({});
              setAcik(true);
            }}
          >
            {acmaMetni ?? `${form.title} bilgilerini ${kayitli ? 'değiştir' : 'gir'}`}
          </button>
        </div>
      )}
    </form>
  );
}
