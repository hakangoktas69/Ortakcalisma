import { isAllowed } from '@eworks/identity-access';
import { createReminder } from '@eworks/workspace';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Kişisel hatırlatma ekle (genel_bakis.takvim.remind). Hatırlatma yalnız sahibine görünür; firma kapsamı RLS'te.
type Govde = { title?: unknown; remindOn?: unknown; remindTime?: unknown; category?: unknown; firmId?: unknown; note?: unknown; remindDays?: unknown; sourceEntry?: unknown };
const metin = (v: unknown) => (typeof v === 'string' ? v : '');

export async function POST(req: Request) {
  const s = await apiIzni(req, 'genel_bakis.takvim.remind', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<Govde>(req, 8 * 1024);
  if (!g) return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  const r = await createReminder(
    baglam(s),
    {
      title: metin(g.title),
      remindOn: metin(g.remindOn),
      remindTime: metin(g.remindTime),
      category: metin(g.category),
      firmId: metin(g.firmId),
      note: metin(g.note),
      remindDays: typeof g.remindDays === 'number' ? g.remindDays : Number(metin(g.remindDays)),
      sourceEntry: metin(g.sourceEntry),
    },
    (k) => isAllowed(s.grants, k),
    konteyner().hatirlatmalar,
  );
  if (r.ok) return Response.json({ id: r.value.id }, { status: 201 });
  if (r.error === 'yetki_yok') return Response.json({ mesaj: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
  return Response.json({ mesaj: 'Hatırlatma bilgilerini kontrol edin.', alanlar: (r.errors ?? []).map((e) => ({ alan: e.field, mesaj: e.message })) }, { status: 422 });
}
