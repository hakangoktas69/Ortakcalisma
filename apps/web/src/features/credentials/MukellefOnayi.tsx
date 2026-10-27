'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// Mükellef onayı (D18, D46): firmanın kurum hesabını (bugün yalnız e-Tebligat) kullanmak için müşavir mükelleften aldığı yazılı
// onayı tarih ve yöntemle beyan eder. Eworks belgeyi doğrulamaz; beyan denetim kaydına yazılır, geri alınabilir.

type Durum = { active: boolean; consentedOn: string; methodTitle: string } | null;

export function MukellefOnayi({ csrf, firmId, durum, yontemler, bugun }: { csrf: string; firmId: string; durum: Durum; yontemler: readonly { id: string; title: string }[]; bugun: string }) {
  const router = useRouter();
  const [mesaj, setMesaj] = useState<{ tur: 'basari' | 'hata'; metin: string } | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  async function gonder(method: 'PUT' | 'DELETE', govde: Record<string, unknown>, basari: string) {
    setBekliyor(true);
    const r = await istek('/api/kurum-hesaplari/onay', method, csrf, { firmId, ...govde });
    setBekliyor(false);
    setMesaj(r.ok ? { tur: 'basari', metin: basari } : { tur: 'hata', metin: r.mesaj });
    if (r.ok) router.refresh();
  }
  return (
    <div className="onay">
      <h4>Mükellef onayı</h4>
      {mesaj ? (
        <p className={mesaj.tur} role="status">
          {mesaj.metin}
        </p>
      ) : null}
      {durum?.active ? (
        <>
          <p>
            <span className="etiket iyi">Onay var</span> {durum.consentedOn.split('-').reverse().join('.')} · {durum.methodTitle}
          </p>
          <button type="button" className="dugme ikincil kucuk" disabled={bekliyor} onClick={() => void gonder('DELETE', {}, 'Mükellef onayı geri alındı.')}>
            Onayı geri al
          </button>
        </>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget);
            void gonder('PUT', { method: String(v.get('yontem') ?? ''), consentedOn: String(v.get('tarih') ?? ''), attested: v.get('beyan') === 'evet' }, 'Mükellef onayı kaydedildi.');
          }}
        >
          <p className="alt">
            {durum ? 'Onay geri alınmış. ' : ''}Firmanın kurum hesabı (e-Tebligat) yalnız mükellefin yazılı onayıyla kullanılır. Onayı aldığınız tarihi ve yolu girin.
          </p>
          <div className="form-satir">
            <label>
              Onay yolu
              <select name="yontem" defaultValue="sozlesme">
                {yontemler.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Onay tarihi
              <input type="date" name="tarih" required max={bugun} defaultValue={bugun} />
            </label>
          </div>
          <label className="secim">
            <input type="checkbox" name="beyan" value="evet" required /> Mükelleften yazılı onay aldığımı beyan ederim.
          </label>
          <div className="eylemler">
            <button type="submit" className="dugme ikincil" disabled={bekliyor}>
              Onayı kaydet
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
