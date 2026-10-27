import { isAllowed } from '@eworks/identity-access';
import { deleteReminder, setReminderDone } from '@eworks/workspace';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Hatırlatmayı tamamlandı işaretle / geri al (POST { done }) ya da sil (DELETE). Başkasının hatırlatması RLS ile görünmez → 404.
const HATA = { yetki_yok: [403, 'Bu işlem için yetkiniz yok.'], bulunamadi: [404, 'Hatırlatma bulunamadı.'] } as const;
const yanit = (r: { ok: true; value: { id: string } } | { ok: false; error: keyof typeof HATA }) =>
  r.ok ? Response.json({ id: r.value.id }) : Response.json({ mesaj: HATA[r.error][1] }, { status: HATA[r.error][0] });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiIzni(req, 'genel_bakis.takvim.remind', true);
  if (s instanceof Response) return s;
  const { id } = await params;
  const g = await jsonGovde<{ done?: unknown }>(req, 256);
  if (!g || typeof g.done !== 'boolean') return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return yanit({ ok: false, error: 'bulunamadi' });
  return yanit(await setReminderDone(baglam(s), id, g.done, (k) => isAllowed(s.grants, k), konteyner().hatirlatmalar));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiIzni(req, 'genel_bakis.takvim.remind', true);
  if (s instanceof Response) return s;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return yanit({ ok: false, error: 'bulunamadi' });
  return yanit(await deleteReminder(baglam(s), id, (k) => isAllowed(s.grants, k), konteyner().hatirlatmalar));
}
