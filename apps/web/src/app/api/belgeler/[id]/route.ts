import { downloadName, openDocument } from '@eworks/documents';
import { isAllowed } from '@eworks/identity-access';
import { getFiling } from '@eworks/social-security';
import { getDeclaration } from '@eworks/tax-filing';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam } from '@/bff/oturum.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// PDF indir: yetki belgenin konusuna göredir — beyanname/tahakkuk `beyanname.belge.download`, SGK tahakkuk/hizmet listesi
// `sgk.ebildirge.download`. Kapsam dışı ya da başka ofisin belgesi 404 (RLS). Gövde S3'ten akış; dosya adında kişisel veri
// yok; her indirme denetim kaydına yazılır.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiIzni(req, 'genel_bakis.panel.view');
  if (s instanceof Response) return s;
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ mesaj: 'Belge bulunamadı.' }, { status: 404 });
  const ctx = baglam(s);
  const k = konteyner();
  const doc = await k.belgeler.repo.get(ctx, id);
  if (!doc) return Response.json({ mesaj: 'Belge bulunamadı.' }, { status: 404 });
  if (!isAllowed(s.grants, doc.subjectKind === 'sgk_filing' ? 'sgk.ebildirge.download' : 'beyanname.belge.download')) {
    return Response.json({ mesaj: 'Bu işlem için yetkiniz yok.' }, { status: 403 });
  }
  const r = await openDocument(ctx, id, k.belgeler);
  if (!r.ok) {
    return r.error === 'bulunamadi'
      ? Response.json({ mesaj: 'Belge bulunamadı.' }, { status: 404 })
      : Response.json({ mesaj: 'Belgenin saklama süresi doldu; senkronla yeniden alınabilir.' }, { status: 410 });
  }
  const [tur, donem] =
    doc.subjectKind === 'sgk_filing'
      ? ['MUHSGK', (await getFiling(ctx, doc.subjectId, k.sgk))?.period ?? '']
      : await getDeclaration(ctx, doc.subjectId, k.beyannameler).then((b) => [b?.type ?? 'belge', b?.periodStart ?? '']);
  return new Response(r.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(r.doc.size),
      'content-disposition': `attachment; filename="${downloadName(r.doc.kind, tur!, donem!)}"`,
      'x-content-type-options': 'nosniff',
    },
  });
}
