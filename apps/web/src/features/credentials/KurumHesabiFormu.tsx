'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// Kurum (GİB) hesabı girişi. Bilgiler yalnız Vault'a gider; form gönderildikten sonra temizlenir, şifre geri okunamaz.
export function KurumHesabiFormu({ csrf, sahip, sahipId, baslik, aciklama }: { csrf: string; sahip: 'advisor' | 'firm'; sahipId: string; baslik: string; aciklama: string }) {
  const router = useRouter();
  const [durum, setDurum] = useState<{ tur: 'basari' | 'hata'; mesaj: string } | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  return (
    <form
      className="form"
      autoComplete="off"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = new FormData(form);
        setBekliyor(true);
        const r = await istek('/api/kurum-hesaplari', 'PUT', csrf, {
          ownerKind: sahip,
          ownerId: sahipId,
          institution: 'GIB',
          username: String(v.get('kullanici') ?? ''),
          password: String(v.get('sifre') ?? ''),
        });
        form.reset();
        setBekliyor(false);
        setDurum(r.ok ? { tur: 'basari', mesaj: 'GİB hesabı Vault’a kaydedildi.' } : { tur: 'hata', mesaj: r.mesaj });
        if (r.ok) router.refresh();
      }}
    >
      <h2>{baslik}</h2>
      <p className="alt">{aciklama}</p>
      {durum ? (
        <p className={durum.tur} role="status">
          {durum.mesaj}
        </p>
      ) : null}
      <div className="form-satir">
        <label>
          GİB kullanıcı kodu
          <input name="kullanici" required maxLength={256} autoComplete="off" />
        </label>
        <label>
          GİB şifresi
          <input name="sifre" type="password" required maxLength={1024} autoComplete="new-password" />
        </label>
      </div>
      <div className="eylemler">
        <button type="submit" className="dugme birincil" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'GİB hesabını kaydet'}
        </button>
      </div>
    </form>
  );
}
