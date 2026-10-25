import { declarationsCsv, listDeclarations } from '@eworks/tax-filing';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam } from '@/bff/oturum.ts';

// e-Beyanname listesi CSV (beyanname.liste.export): ekrandaki süzgeçle aynı satırlar.
export async function GET(req: Request) {
  const s = await apiIzni(req, 'beyanname.liste.export');
  if (s instanceof Response) return s;
  const u = new URL(req.url).searchParams;
  const yil = /^\d{4}$/.test(u.get('yil') ?? '') ? Number(u.get('yil')) : undefined;
  const satirlar = await listDeclarations(baglam(s), { q: u.get('q') ?? '', type: u.get('tur') ?? '', year: yil, limit: 5000 }, konteyner().beyannameler);
  return new Response(declarationsCsv(satirlar), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="Eworks_Beyannameler_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
