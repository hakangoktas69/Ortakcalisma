import { isAllowed } from '@eworks/identity-access';
import { correctEntry } from '@eworks/workspace';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Takvim tarihi düzeltme (genel_bakis.takvim.edit, yalnız ofis yöneticisi; veritabanı da denetler ve denetim kaydına yazar).
// Gövde: { id, date: 'YYYY-MM-DD' | null } — null düzeltmeyi kaldırır.
const HATA = { yetki_yok: [403, 'Bu işlem için yetkiniz yok.'], gecersiz_tarih: [422, 'Geçerli bir tarih girin.'], bulunamadi: [404, 'Takvim kaydı bulunamadı.'] } as const;

export async function PUT(req: Request) {
  const s = await apiIzni(req, 'genel_bakis.takvim.edit', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ id?: unknown; date?: unknown }>(req, 1024);
  if (!g || typeof g.id !== 'string' || g.id.length > 80 || !(g.date === null || typeof g.date === 'string')) return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  const r = await correctEntry(baglam(s), g.id, g.date, (k) => isAllowed(s.grants, k), konteyner().takvim);
  if (r.ok) return Response.json({ id: r.value.id });
  const [durum, mesaj] = HATA[r.error];
  return Response.json({ mesaj }, { status: durum });
}
