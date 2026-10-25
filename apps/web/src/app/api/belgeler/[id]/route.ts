import { downloadName, openDocument } from '@eworks/documents';
import { getDeclaration } from '@eworks/tax-filing';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam } from '@/bff/oturum.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// PDF indir (beyanname.belge.download): kapsam dışı ya da başka ofisin belgesi 404 (RLS). Gövde S3'ten akış olarak gelir;
// dosya adında kişisel veri yok. İndirme denetim kaydına yazılır.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiIzni(req, 'beyanname.belge.download');
  if (s instanceof Response) return s;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ mesaj: 'Belge bulunamadı.' }, { status: 404 });
  const ctx = baglam(s);
  const r = await openDocument(ctx, id, konteyner().belgeler);
  if (!r.ok) {
    return r.error === 'bulunamadi'
      ? Response.json({ mesaj: 'Belge bulunamadı.' }, { status: 404 })
      : Response.json({ mesaj: 'Belgenin saklama süresi doldu; senkronla yeniden alınabilir.' }, { status: 410 });
  }
  const konu = await getDeclaration(ctx, r.doc.subjectId, konteyner().beyannameler);
  const ad = downloadName(r.doc.kind, konu?.type ?? 'belge', konu?.periodStart ?? '');
  return new Response(r.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(r.doc.size),
      'content-disposition': `attachment; filename="${ad}"`,
      'x-content-type-options': 'nosniff',
    },
  });
}
