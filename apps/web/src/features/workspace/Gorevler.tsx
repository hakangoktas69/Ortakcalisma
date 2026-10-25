'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { istek } from '@/shared/ui/istek.ts';

// Görev formu ve satır işlemleri (eski portalın "Yeni Görev" çekmecesi ve görev detayındaki durum düğmeleri).

type Secenek = { id: string; ad: string };

export function GorevFormu({ csrf, firmalar, uyeler, ben, atayabilir, bugun }: { csrf: string; firmalar: Secenek[]; uyeler: Secenek[]; ben: string; atayabilir: boolean; bugun: string }) {
  const router = useRouter();
  const [durum, setDurum] = useState<{ tur: 'basari' | 'hata'; mesaj: string } | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  return (
    <form
      className="form kart"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = new FormData(form);
        setBekliyor(true);
        const r = await istek('/api/gorevler', 'POST', csrf, {
          title: v.get('title'),
          firmId: v.get('firmId') || null,
          dueOn: v.get('dueOn'),
          assigneeId: v.get('assigneeId') || null,
        });
        setBekliyor(false);
        if (r.ok) {
          form.reset();
          setDurum({ tur: 'basari', mesaj: 'Görev oluşturuldu.' });
          router.refresh();
        } else setDurum({ tur: 'hata', mesaj: r.alanlar?.[0]?.mesaj ?? r.mesaj });
      }}
    >
      <h2>Yeni görev</h2>
      {durum ? (
        <p className={durum.tur} role={durum.tur === 'hata' ? 'alert' : 'status'}>
          {durum.mesaj}
        </p>
      ) : null}
      <div className="form-satir">
        <label>
          Görev başlığı
          <input name="title" required maxLength={120} placeholder="Örn. Ekim dönemi beyanname kontrolü" />
        </label>
        <label>
          Mükellef
          <select name="firmId" defaultValue="">
            <option value="">Ofis geneli</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
          </select>
        </label>
        <label>
          Son tarih
          <input name="dueOn" type="date" required defaultValue={bugun} />
        </label>
        <label>
          Sorumlu
          <select name="assigneeId" defaultValue={ben} disabled={!atayabilir}>
            {uyeler.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ad}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="eylemler">
        <button type="submit" className="dugme birincil" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Görevi kaydet'}
        </button>
      </div>
    </form>
  );
}

const DURUMLAR = ['Bekliyor', 'Devam Ediyor', 'Öncelikli', 'Tamamlandı'] as const;

export function GorevIslemleri({
  csrf,
  id,
  version,
  durum,
  sorumlu,
  uyeler,
  izin,
}: {
  csrf: string;
  id: string;
  version: number;
  durum: string;
  sorumlu: string | null;
  uyeler: Secenek[];
  izin: { degistir: boolean; kapat: boolean; ata: boolean };
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const gonder = async (uc: string, govde: unknown) => {
    const r = await istek(uc, 'POST', csrf, govde);
    if (r.ok) router.refresh();
    else setHata(r.mesaj);
  };
  const izinli = (d: string) => (d === 'Tamamlandı' || durum === 'Tamamlandı' ? izin.kapat : izin.degistir);
  return (
    <span className="eylemler">
      <select
        aria-label="Durum"
        value={durum}
        disabled={!izin.degistir && !izin.kapat}
        onChange={(e) => {
          if (izinli(e.target.value)) void gonder(`/api/gorevler/${id}/durum`, { status: e.target.value, version });
          else setHata('Bu durum için yetkiniz yok.');
        }}
      >
        {DURUMLAR.map((d) => (
          <option key={d} disabled={!izinli(d) && d !== durum}>
            {d}
          </option>
        ))}
      </select>
      {izin.ata ? (
        <select aria-label="Sorumlu" value={sorumlu ?? ''} onChange={(e) => void gonder(`/api/gorevler/${id}/ata`, { assigneeId: e.target.value || null, version })}>
          <option value="">Atanmamış</option>
          {uyeler.map((u) => (
            <option key={u.id} value={u.id}>
              {u.ad}
            </option>
          ))}
        </select>
      ) : null}
      {hata ? (
        <span className="hata" role="alert">
          {hata}
        </span>
      ) : null}
    </span>
  );
}

export function NotFormu({ csrf, firmalar }: { csrf: string; firmalar: Secenek[] }) {
  const router = useRouter();
  const [durum, setDurum] = useState<{ tur: 'basari' | 'hata'; mesaj: string } | null>(null);
  return (
    <form
      className="form kart"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = new FormData(form);
        const r = await istek('/api/notlar', 'POST', csrf, { firmId: v.get('firmId'), body: v.get('body') });
        if (r.ok) {
          form.reset();
          setDurum({ tur: 'basari', mesaj: 'Not eklendi.' });
          router.refresh();
        } else setDurum({ tur: 'hata', mesaj: r.mesaj });
      }}
    >
      <h2>Yeni not</h2>
      {durum ? (
        <p className={durum.tur} role={durum.tur === 'hata' ? 'alert' : 'status'}>
          {durum.mesaj}
        </p>
      ) : null}
      <div className="form-satir">
        <label>
          Mükellef
          <select name="firmId" required defaultValue="">
            <option value="" disabled>
              Seçin
            </option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Not
        <textarea name="body" required maxLength={2000} rows={3} />
      </label>
      <div className="eylemler">
        <button type="submit" className="dugme birincil">
          Notu kaydet
        </button>
      </div>
    </form>
  );
}
