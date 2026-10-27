'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// Takvim tarihini düzeltme (yalnız ofis yöneticisi). Kaynak verisi değişmez; düzeltme ayrı tutulur ve denetim kaydına yazılır.
export function TakvimDuzelt({ csrf, id, tarih, duzeltilmis, baslik }: { csrf: string; id: string; tarih: string; duzeltilmis: boolean; baslik: string }) {
  const router = useRouter();
  const [durum, setDurum] = useState<{ tur: 'basari' | 'hata'; mesaj: string } | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  async function gonder(date: string | null) {
    setBekliyor(true);
    const r = await istek('/api/takvim', 'PUT', csrf, { id, date });
    setBekliyor(false);
    setDurum(r.ok ? { tur: 'basari', mesaj: date ? 'Tarih düzeltildi.' : 'Düzeltme kaldırıldı.' } : { tur: 'hata', mesaj: r.mesaj });
    if (r.ok) router.refresh();
  }
  return (
    <form
      className="takvim-duzelt"
      onSubmit={(e) => {
        e.preventDefault();
        void gonder(String(new FormData(e.currentTarget).get('tarih') ?? ''));
      }}
    >
      <label>
        Doğru tarih
        <input type="date" name="tarih" required defaultValue={tarih} aria-label={`Doğru tarih: ${baslik}`} />
      </label>
      <button type="submit" className="dugme ikincil kucuk" disabled={bekliyor}>
        Tarihi düzelt
      </button>
      {duzeltilmis ? (
        <button type="button" className="dugme ikincil kucuk" disabled={bekliyor} onClick={() => void gonder(null)}>
          Düzeltmeyi kaldır
        </button>
      ) : null}
      {durum ? (
        <span className={durum.tur} role="status">
          {durum.mesaj}
        </span>
      ) : null}
    </form>
  );
}
