import { getJob, JOB_PERMISSION } from '@eworks/sync';
import { isAllowed } from '@eworks/identity-access';
import { isGorunumu } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam } from '@/bff/oturum.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// İş durumu (istemci yoklaması). Başka ofisin işi RLS ile görünmez → 404. İşi görmek, o işi başlatma yetkisini ister.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await apiIzni(req, 'genel_bakis.panel.view');
  if (s instanceof Response) return s;
  if (!UUID.test(id)) return Response.json({ mesaj: 'İş bulunamadı.' }, { status: 404 });
  const j = await getJob(baglam(s), id, konteyner().isler);
  if (!j || !isAllowed(s.grants, JOB_PERMISSION[j.kind])) return Response.json({ mesaj: 'İş bulunamadı.' }, { status: 404 });
  return Response.json(isGorunumu(j));
}
