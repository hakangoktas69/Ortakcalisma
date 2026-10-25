import { archiveFirm } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam } from '@/bff/oturum.ts';

// Arşivleme (firmalar.kart.archive): veri silinmez (10 yıl, D23), firma listeden kalkar, VKN serbest kalır.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiIzni(req, 'firmalar.kart.archive', true);
  if (s instanceof Response) return s;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  const r = await archiveFirm(baglam(s), id, konteyner().firmalar);
  return r.ok ? Response.json(r.value) : Response.json({ mesaj: 'Firma bulunamadı.' }, { status: 404 });
}
