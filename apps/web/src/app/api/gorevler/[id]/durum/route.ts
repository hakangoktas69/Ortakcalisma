import { isAllowed } from '@eworks/identity-access';
import { changeStatus } from '@eworks/workspace';
import { gorevHatasi } from '@/bff/gorevler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Görev durumu: tamamlama ve yeniden açma gorevler.close, diğer durumlar gorevler.create ister (use-case seçer).
// Giriş denetimi görüntüleme yetkisidir; asıl yetki duruma göre use-case'te.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiIzni(req, 'gorevler.view', true);
  if (s instanceof Response) return s;
  const { id } = await params;
  const g = await jsonGovde<{ status?: unknown; version?: unknown }>(req, 1024);
  if (!g || typeof g.status !== 'string' || !Number.isInteger(g.version)) return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return gorevHatasi('bulunamadi');
  const r = await changeStatus(baglam(s), id, g.version as number, g.status, (k) => isAllowed(s.grants, k), konteyner().gorevler);
  return r.ok ? Response.json({ id }) : gorevHatasi(r.error);
}
