import { exportFirms, type Segment } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam } from '@/bff/oturum.ts';

// Firma listesi CSV (firmalar.liste.export): ekrandaki süzgeçlerle aynı satırlar; dışa aktarma denetim kaydına yazılır.
export async function GET(req: Request) {
  const s = await apiIzni(req, 'firmalar.liste.export');
  if (s instanceof Response) return s;
  const u = new URL(req.url).searchParams;
  const csv = await exportFirms(
    baglam(s),
    { q: u.get('q') ?? '', status: u.get('durum') ?? '', kind: u.get('tur') ?? '', segment: (u.get('segment') as Segment) || 'all' },
    konteyner().firmalar,
  );
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="Eworks_Firmalar_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
