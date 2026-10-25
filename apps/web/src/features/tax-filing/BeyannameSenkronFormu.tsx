'use client';

import { IsDurumuSatiri, useKurumIsi, type IsDurumu } from '@/features/sync/KurumIsi.tsx';

// Beyanname / MUHSGK (SGK e-Bildirge) senkronu: gönderim (yükleme) ay aralığı + kapsam (tek mükellef ya da sözleşmeli tüm mükellefler).
// Kapsamı sunucu yeniden doğrular; yalnız Aracılık ve Sorumluluk sözleşmeli mükellefler sorgulanır.
export function BeyannameSenkronFormu({
  csrf,
  ilk,
  firmalar,
  varsayilanAy,
  uc = '/api/sync/beyannameler',
  dugme = 'Senkronu başlat',
}: {
  uc?: string;
  dugme?: string;
  csrf: string;
  ilk: IsDurumu | null;
  firmalar: { id: string; ad: string }[];
  varsayilanAy: string;
}) {
  const k = useKurumIsi(ilk);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget);
        void k.baslat(uc, csrf, { bas: v.get('bas'), bit: v.get('bit'), firmaId: v.get('firma') || null });
      }}
    >
      <div className="form-satir">
        <label>
          Gönderim ayı (başlangıç)
          <input name="bas" type="month" required defaultValue={varsayilanAy} min="2004-01" max={varsayilanAy} />
        </label>
        <label>
          Gönderim ayı (bitiş)
          <input name="bit" type="month" required defaultValue={varsayilanAy} min="2004-01" max={varsayilanAy} />
        </label>
        <label>
          Mükellef
          <select name="firma" defaultValue="">
            <option value="">Sözleşmeli tüm mükellefler ({firmalar.length})</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="eylemler">
        <button type="submit" className="dugme birincil" disabled={k.bekliyor || k.suruyor}>
          {k.suruyor ? 'Çalışıyor…' : dugme}
        </button>
      </div>
      <IsDurumuSatiri is={k.is} hata={k.hata} />
    </form>
  );
}
